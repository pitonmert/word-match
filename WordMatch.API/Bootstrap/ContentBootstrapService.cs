using Microsoft.EntityFrameworkCore;
using WordMatch.API.Data;
using WordMatch.API.Features.Study;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Bootstrap;

public sealed class ContentBootstrapService(ApplicationDbContext db)
{
    private static readonly string[] ExpectedHeaders =
    [
        "ImportKey",
        "English",
        "TurkishTranslations",
        "PartOfSpeech",
        "PastSimple",
        "PastParticiple",
        "IsIrregular",
        "Level",
        "Topic",
        "TopicSortOrder",
        "WordSortOrder",
        "LearningGroupSortOrder",
    ];

    public async Task<ContentBootstrapResult> ImportAsync(
        string sourcePath,
        CancellationToken cancellationToken = default
    )
    {
        if (!File.Exists(sourcePath))
            throw new WordBootstrapValidationException(
                $"İçerik bootstrap CSV dosyası bulunamadı: {sourcePath}"
            );

        var sourceWords = ParseAndValidate(
            await File.ReadAllTextAsync(sourcePath, cancellationToken)
        );
        var topics = ValidateAndGroupCurriculum(sourceWords);

        if (!db.Database.IsRelational())
            return await ImportCoreAsync(sourceWords, topics, cancellationToken);

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(
                cancellationToken
            );
            try
            {
                var result = await ImportCoreAsync(sourceWords, topics, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return result;
            }
            catch
            {
                await transaction.RollbackAsync(CancellationToken.None);
                throw;
            }
        });
    }

    private async Task<ContentBootstrapResult> ImportCoreAsync(
        IReadOnlyList<BootstrapWord> sourceWords,
        IReadOnlyList<CurriculumTopicSource> topics,
        CancellationToken cancellationToken
    )
    {
        var (wordsByImportKey, wordsCreated, wordsAdopted, wordsUpdated, wordsUnchanged) =
            await ImportWordsAsync(sourceWords, cancellationToken);
        var (topicsCreated, topicsUpdated, topicsRetired, wordLinksCreated, wordLinksUpdated) =
            await ImportCurriculumAsync(topics, wordsByImportKey, cancellationToken);

        return new ContentBootstrapResult(
            wordsCreated,
            wordsAdopted,
            wordsUpdated,
            wordsUnchanged,
            topicsCreated,
            topicsUpdated,
            topicsRetired,
            wordLinksCreated,
            wordLinksUpdated
        );
    }

    private async Task<(
        Dictionary<string, Word> WordsByImportKey,
        int Created,
        int Adopted,
        int Updated,
        int Unchanged
    )> ImportWordsAsync(
        IReadOnlyList<BootstrapWord> sourceWords,
        CancellationToken cancellationToken
    )
    {
        var existingWords = await db.Words.AsTracking().ToListAsync(cancellationToken);
        var byImportKey = existingWords.ToDictionary(
            word => word.ImportKey,
            StringComparer.Ordinal
        );
        var legacyByContent = existingWords
            .Where(word => word.ImportKey.StartsWith("legacy-", StringComparison.Ordinal))
            .ToDictionary(
                word => CreateLegacyContentKey(word.English, word.PartOfSpeech),
                StringComparer.OrdinalIgnoreCase
            );

        var created = 0;
        var adopted = 0;
        var updated = 0;
        var unchanged = 0;

        foreach (var source in sourceWords)
        {
            if (byImportKey.TryGetValue(source.ImportKey, out var existing))
            {
                if (Apply(source, existing))
                    updated++;
                else
                    unchanged++;

                continue;
            }

            if (
                legacyByContent.TryGetValue(
                    CreateLegacyContentKey(source.English, source.PartOfSpeech),
                    out existing
                )
            )
            {
                existing.ImportKey = source.ImportKey;
                Apply(source, existing);
                byImportKey.Add(source.ImportKey, existing);
                adopted++;
                continue;
            }

            var newWord = source.ToWord();
            db.Words.Add(newWord);
            byImportKey.Add(source.ImportKey, newWord);
            created++;
        }

        await db.SaveChangesAsync(cancellationToken);
        return (byImportKey, created, adopted, updated, unchanged);
    }

    private async Task<(
        int TopicsCreated,
        int TopicsUpdated,
        int TopicsRetired,
        int WordLinksCreated,
        int WordLinksUpdated
    )> ImportCurriculumAsync(
        IReadOnlyList<CurriculumTopicSource> topics,
        IReadOnlyDictionary<string, Word> wordsByImportKey,
        CancellationToken cancellationToken
    )
    {
        var existingTopics = await db
            .CurriculumTopics.Include(topic => topic.Words)
            .AsTracking()
            .ToListAsync(cancellationToken);
        var existingByKey = existingTopics.ToDictionary(topic => (topic.Level, topic.Topic));
        var originalSortOrders = existingTopics.ToDictionary(
            topic => topic.Id,
            topic => topic.SortOrder
        );
        var originalStatuses = existingTopics.ToDictionary(
            topic => topic.Id,
            topic => topic.Status
        );

        var temporaryOffset = existingTopics.Count + topics.Count + 1;
        foreach (var topic in existingTopics)
            topic.SortOrder += temporaryOffset;
        if (existingTopics.Count > 0)
            await db.SaveChangesAsync(cancellationToken);

        var topicsByKey = new Dictionary<(WordLevel, WordTopic), CurriculumTopic>();
        var topicsCreated = 0;
        var topicsUpdated = 0;
        foreach (var source in topics)
        {
            if (!existingByKey.TryGetValue((source.Level, source.Topic), out var topic))
            {
                topic = new CurriculumTopic
                {
                    Level = source.Level,
                    Topic = source.Topic,
                    SortOrder = source.SortOrder,
                    Status = CurriculumTopicStatus.Active,
                };
                db.CurriculumTopics.Add(topic);
                topicsCreated++;
            }
            else
            {
                var changed =
                    originalSortOrders[topic.Id] != source.SortOrder
                    || originalStatuses[topic.Id] != CurriculumTopicStatus.Active;
                topic.SortOrder = source.SortOrder;
                topic.Status = CurriculumTopicStatus.Active;
                if (changed)
                    topicsUpdated++;
            }

            topicsByKey.Add((source.Level, source.Topic), topic);
        }

        var retiredTopics = existingTopics
            .Where(topic => !topicsByKey.ContainsKey((topic.Level, topic.Topic)))
            .OrderBy(topic => originalSortOrders[topic.Id])
            .ToList();
        var nextRetiredSortOrder = topics
            .GroupBy(topic => topic.Level)
            .ToDictionary(group => group.Key, group => group.Count() + 1);
        var topicsRetired = 0;
        foreach (var topic in retiredTopics)
        {
            var next = nextRetiredSortOrder.GetValueOrDefault(topic.Level, 1);
            topic.SortOrder = next;
            nextRetiredSortOrder[topic.Level] = next + 1;
            if (topic.Status != CurriculumTopicStatus.Retired)
            {
                topic.Status = CurriculumTopicStatus.Retired;
                topicsRetired++;
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        var existingWordLinks = existingTopics
            .SelectMany(topic => topic.Words)
            .ToDictionary(link => link.WordId);
        var toAdd =
            new List<(
                CurriculumTopic Topic,
                int WordId,
                int SortOrder,
                int LearningGroupSortOrder
            )>();
        var wordLinksCreated = 0;
        var wordLinksUpdated = 0;
        foreach (var source in topics)
        {
            var topic = topicsByKey[(source.Level, source.Topic)];
            foreach (var sourceWord in source.Words)
            {
                var wordId = wordsByImportKey[sourceWord.ImportKey].Id;
                if (!existingWordLinks.TryGetValue(wordId, out var link))
                {
                    toAdd.Add(
                        (topic, wordId, sourceWord.WordSortOrder, sourceWord.LearningGroupSortOrder)
                    );
                    wordLinksCreated++;
                    continue;
                }

                var existingTopicForLink = existingTopics.Single(item =>
                    item.Id == link.CurriculumTopicId
                );
                var topicChanged = existingTopicForLink.Id != topic.Id;
                var orderChanged = link.SortOrder != sourceWord.WordSortOrder;
                var groupChanged = link.LearningGroupSortOrder != sourceWord.LearningGroupSortOrder;
                if (!topicChanged && !orderChanged && !groupChanged)
                    continue;

                existingTopicForLink.Words.Remove(link);
                toAdd.Add(
                    (topic, wordId, sourceWord.WordSortOrder, sourceWord.LearningGroupSortOrder)
                );
                wordLinksUpdated++;
            }
        }

        if (toAdd.Count > 0)
            await db.SaveChangesAsync(cancellationToken);

        foreach (var (topic, wordId, sortOrder, learningGroupSortOrder) in toAdd)
            topic.Words.Add(
                new CurriculumTopicWord
                {
                    WordId = wordId,
                    SortOrder = sortOrder,
                    LearningGroupSortOrder = learningGroupSortOrder,
                }
            );

        await db.SaveChangesAsync(cancellationToken);
        return (topicsCreated, topicsUpdated, topicsRetired, wordLinksCreated, wordLinksUpdated);
    }

    private static IReadOnlyList<BootstrapWord> ParseAndValidate(string csv)
    {
        var rows = WordBootstrapCsv.ParseRows(csv);
        if (rows.Count == 0 || !rows[0].SequenceEqual(ExpectedHeaders, StringComparer.Ordinal))
            throw new WordBootstrapValidationException(
                "CSV başlığı beklenen içerik bootstrap şemasıyla eşleşmiyor."
            );

        var words = new List<BootstrapWord>(rows.Count - 1);
        var keys = new HashSet<string>(StringComparer.Ordinal);
        for (var index = 1; index < rows.Count; index++)
        {
            var row = rows[index];
            if (row.Length != ExpectedHeaders.Length)
                throw new WordBootstrapValidationException(
                    $"CSV satır {index + 1} {ExpectedHeaders.Length} alan içermelidir."
                );

            var source = BootstrapWord.Create(row, index + 1);
            if (!keys.Add(source.ImportKey))
                throw new WordBootstrapValidationException(
                    $"CSV'de yinelenen ImportKey var: {source.ImportKey}."
                );

            words.Add(source);
        }

        return words;
    }

    private static IReadOnlyList<CurriculumTopicSource> ValidateAndGroupCurriculum(
        IReadOnlyList<BootstrapWord> sourceWords
    )
    {
        var topics = sourceWords
            .GroupBy(word => (word.Level, word.Topic))
            .Select(ValidateTopic)
            .OrderBy(topic => topic.Level)
            .ThenBy(topic => topic.SortOrder)
            .ToList();

        foreach (var level in topics.GroupBy(topic => topic.Level))
        {
            if (
                !level
                    .Select(topic => topic.SortOrder)
                    .OrderBy(order => order)
                    .SequenceEqual(Enumerable.Range(1, level.Count()))
            )
                throw new WordBootstrapValidationException(
                    $"{level.Key} seviyesindeki konu sıraları 1'den başlayan kesintisiz bir sıra olmalıdır."
                );
        }

        return topics;
    }

    private static CurriculumTopicSource ValidateTopic(
        IGrouping<(WordLevel Level, WordTopic Topic), BootstrapWord> group
    )
    {
        var rows = group.OrderBy(word => word.WordSortOrder).ToList();
        var first = rows[0];
        if (
            rows.Any(word => word.TopicSortOrder != first.TopicSortOrder)
            || !rows.Select(word => word.WordSortOrder)
                .SequenceEqual(Enumerable.Range(1, rows.Count))
            || !rows.Select(word => word.LearningGroupSortOrder)
                .Distinct()
                .OrderBy(order => order)
                .SequenceEqual(
                    Enumerable.Range(
                        1,
                        rows.Select(word => word.LearningGroupSortOrder).Distinct().Count()
                    )
                )
        )
            throw new WordBootstrapValidationException(
                $"{group.Key.Level} · {group.Key.Topic} konusu tutarsız konu, kelime veya öğrenme grubu sırası içeriyor."
            );

        return new CurriculumTopicSource(
            group.Key.Level,
            group.Key.Topic,
            first.TopicSortOrder,
            rows
        );
    }

    private static bool Apply(BootstrapWord source, Word target)
    {
        if (source.HasSameContentAs(target))
            return false;

        target.English = source.English;
        target.TurkishTranslations = source.TurkishTranslations;
        target.PartOfSpeech = source.PartOfSpeech;
        target.PastSimple = source.PastSimple;
        target.PastParticiple = source.PastParticiple;
        target.IsIrregular = source.IsIrregular;
        target.Level = source.Level;
        target.Topic = source.Topic;
        return true;
    }

    private static string CreateLegacyContentKey(string english, WordPartOfSpeech partOfSpeech) =>
        $"{english}{partOfSpeech}";

    private sealed record CurriculumTopicSource(
        WordLevel Level,
        WordTopic Topic,
        int SortOrder,
        IReadOnlyList<BootstrapWord> Words
    );

    private sealed record BootstrapWord(
        string ImportKey,
        string English,
        string[] TurkishTranslations,
        WordPartOfSpeech PartOfSpeech,
        string? PastSimple,
        string? PastParticiple,
        bool IsIrregular,
        WordLevel Level,
        WordTopic Topic,
        int TopicSortOrder,
        int WordSortOrder,
        int LearningGroupSortOrder
    )
    {
        public static BootstrapWord Create(string[] row, int rowNumber)
        {
            var importKey = row[0].Trim();
            if (
                importKey.Length is 0 or > 64
                || importKey.StartsWith("legacy-", StringComparison.Ordinal)
                || importKey.Any(character =>
                    !(char.IsAsciiLetterOrDigit(character) || character == '-')
                )
            )
                throw new WordBootstrapValidationException(
                    $"CSV satır {rowNumber} geçerli bir ImportKey içermiyor."
                );

            if (
                string.IsNullOrWhiteSpace(row[1])
                || !Enum.TryParse<WordPartOfSpeech>(row[3], out var partOfSpeech)
                || !bool.TryParse(row[6], out var isIrregular)
                || !Enum.TryParse<WordLevel>(row[7], out var level)
                || !Enum.TryParse<WordTopic>(row[8], out var topic)
            )
                throw new WordBootstrapValidationException(
                    $"CSV satır {rowNumber} geçersiz kelime metadata'sı içeriyor."
                );

            var translations = WordBootstrapCsv.ParsePostgresTextArray(row[2]);
            if (translations.Length == 0 || translations.Any(string.IsNullOrWhiteSpace))
                throw new WordBootstrapValidationException(
                    $"CSV satır {rowNumber} en az bir boş olmayan Türkçe karşılık içermelidir."
                );

            var pastSimple = string.IsNullOrEmpty(row[4]) ? null : row[4];
            var pastParticiple = string.IsNullOrEmpty(row[5]) ? null : row[5];
            var hasValidVerbMetadata =
                partOfSpeech == WordPartOfSpeech.Verb
                    ? pastSimple is not null && pastParticiple is not null
                    : pastSimple is null && pastParticiple is null && !isIrregular;
            if (!hasValidVerbMetadata)
                throw new WordBootstrapValidationException(
                    $"CSV satır {rowNumber} geçersiz fiil metadata'sı içeriyor."
                );

            if (
                !int.TryParse(row[9], out var topicSortOrder)
                || topicSortOrder <= 0
                || !int.TryParse(row[10], out var wordSortOrder)
                || wordSortOrder <= 0
                || !int.TryParse(row[11], out var learningGroupSortOrder)
                || learningGroupSortOrder <= 0
            )
                throw new WordBootstrapValidationException(
                    $"CSV satır {rowNumber} geçersiz konu veya kelime sırası içeriyor."
                );

            return new BootstrapWord(
                importKey,
                row[1],
                translations,
                partOfSpeech,
                pastSimple,
                pastParticiple,
                isIrregular,
                level,
                topic,
                topicSortOrder,
                wordSortOrder,
                learningGroupSortOrder
            );
        }

        public Word ToWord() =>
            new()
            {
                ImportKey = ImportKey,
                English = English,
                TurkishTranslations = TurkishTranslations,
                PartOfSpeech = PartOfSpeech,
                PastSimple = PastSimple,
                PastParticiple = PastParticiple,
                IsIrregular = IsIrregular,
                Level = Level,
                Topic = Topic,
            };

        public bool HasSameContentAs(Word word) =>
            English == word.English
            && TurkishTranslations.SequenceEqual(word.TurkishTranslations, StringComparer.Ordinal)
            && PartOfSpeech == word.PartOfSpeech
            && PastSimple == word.PastSimple
            && PastParticiple == word.PastParticiple
            && IsIrregular == word.IsIrregular
            && Level == word.Level
            && Topic == word.Topic;
    }
}
