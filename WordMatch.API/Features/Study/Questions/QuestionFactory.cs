using System.Globalization;
using System.Text;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Study;

public sealed class QuestionFactory
{
    private static readonly StringComparer TurkishComparer = StringComparer.Create(
        CultureInfo.GetCultureInfo("tr-TR"),
        true
    );

    public QuestionSnapshot CreateSnapshot(
        Word sourceWord,
        QuestionDirection direction,
        QuestionFormat format,
        IReadOnlyCollection<Word> allWords
    )
    {
        if (direction == QuestionDirection.EnglishToTurkish)
        {
            var acceptedAnswers = GetDistinctTurkishTranslations(sourceWord);
            return new QuestionSnapshot(
                sourceWord.English,
                FormatTranslations(acceptedAnswers),
                format == QuestionFormat.Written ? acceptedAnswers : null
            );
        }

        if (direction != QuestionDirection.TurkishToEnglish)
            throw new ArgumentOutOfRangeException(nameof(direction));

        var prompt = SelectTurkishPrompt(sourceWord, allWords);
        var acceptedEnglishAnswers = GetAcceptedEnglishAnswers(prompt, allWords);
        var correctAnswer =
            format == QuestionFormat.Written
                ? string.Join(", ", acceptedEnglishAnswers)
                : sourceWord.English;

        return new QuestionSnapshot(
            prompt,
            correctAnswer,
            format == QuestionFormat.Written ? acceptedEnglishAnswers : null
        );
    }

    public bool IsWrittenAnswerCorrect(
        QuestionDirection direction,
        string answer,
        IReadOnlyCollection<string> acceptedAnswers
    )
    {
        var normalizedAnswer = NormalizeAnswer(answer);
        if (normalizedAnswer.Length == 0)
            return false;

        var comparer =
            direction == QuestionDirection.EnglishToTurkish
                ? TurkishComparer
                : StringComparer.OrdinalIgnoreCase;

        return acceptedAnswers.Any(accepted =>
            comparer.Equals(NormalizeAnswer(accepted), normalizedAnswer)
        );
    }

    public static string NormalizeAnswer(string value)
    {
        return string.Join(
                ' ',
                value.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            )
            .Normalize(NormalizationForm.FormC);
    }

    public GeneratedQuestion CreateOptions(
        string sourceEnglish,
        QuestionDirection direction,
        string correctAnswer,
        IReadOnlyCollection<Word> allWords,
        IReadOnlyList<IEnumerable<Word>> candidateScopes
    )
    {
        var translationsByEnglish = CreateTranslationsByEnglish(allWords);
        var usedTranslations = new HashSet<string>(
            translationsByEnglish[sourceEnglish],
            TurkishComparer
        );
        var wrongOptions = new List<string>(3);

        foreach (var candidates in candidateScopes)
        {
            AddWrongOptions(
                candidates,
                sourceEnglish,
                direction,
                translationsByEnglish,
                wrongOptions,
                usedTranslations
            );
            if (wrongOptions.Count == 3)
                break;
        }

        if (wrongOptions.Count < 3)
        {
            throw new QuestionValidationException(
                "Bir soru oluşturmak için dört farklı cevap gereklidir."
            );
        }

        var options = wrongOptions.Append(correctAnswer).ToList();
        Shuffle(options);
        var comparer =
            direction == QuestionDirection.EnglishToTurkish
                ? TurkishComparer
                : StringComparer.OrdinalIgnoreCase;
        var correctIndex = options.FindIndex(option => comparer.Equals(option, correctAnswer));

        return new GeneratedQuestion(options.ToArray(), correctIndex);
    }

    private static string[] GetDistinctTurkishTranslations(Word sourceWord)
    {
        return sourceWord
            .TurkishTranslations.Select(translation => translation.Trim())
            .Where(translation => translation.Length > 0)
            .Distinct(TurkishComparer)
            .ToArray();
    }

    private static string[] GetAcceptedEnglishAnswers(
        string turkishPrompt,
        IReadOnlyCollection<Word> allWords
    )
    {
        var normalizedPrompt = NormalizeTurkish(turkishPrompt);

        return allWords
            .Where(word =>
                word.TurkishTranslations.Any(translation =>
                    TurkishComparer.Equals(NormalizeTurkish(translation), normalizedPrompt)
                )
            )
            .Select(word => word.English.Trim())
            .Where(english => english.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static string SelectTurkishPrompt(Word sourceWord, IReadOnlyCollection<Word> allWords)
    {
        var candidates = sourceWord
            .TurkishTranslations.Select(
                (translation, index) =>
                    new
                    {
                        DisplayValue = translation.Trim(),
                        NormalizedValue = NormalizeTurkish(translation),
                        Index = index,
                    }
            )
            .Where(item => item.NormalizedValue.Length > 0)
            .GroupBy(item => item.NormalizedValue, TurkishComparer)
            .Select(group => group.First())
            .ToList();

        return candidates
                .OrderBy(candidate =>
                    allWords
                        .Where(word =>
                            word.TurkishTranslations.Any(translation =>
                                TurkishComparer.Equals(
                                    NormalizeTurkish(translation),
                                    candidate.NormalizedValue
                                )
                            )
                        )
                        .Select(word => word.English)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .Count()
                )
                .ThenBy(candidate => candidate.Index)
                .Select(candidate => candidate.DisplayValue)
                .FirstOrDefault()
            ?? throw new QuestionValidationException("Soru kelimesinin çevirisi bulunmuyor.");
    }

    private static Dictionary<string, HashSet<string>> CreateTranslationsByEnglish(
        IEnumerable<Word> words
    )
    {
        return words
            .GroupBy(word => word.English, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => new HashSet<string>(
                    group
                        .SelectMany(word => word.TurkishTranslations)
                        .Select(NormalizeTurkish)
                        .Where(translation => translation.Length > 0),
                    TurkishComparer
                ),
                StringComparer.OrdinalIgnoreCase
            );
    }

    private static void AddWrongOptions(
        IEnumerable<Word> candidates,
        string sourceEnglish,
        QuestionDirection direction,
        IReadOnlyDictionary<string, HashSet<string>> translationsByEnglish,
        ICollection<string> wrongOptions,
        ISet<string> usedTranslations
    )
    {
        var shuffledCandidates = candidates.ToList();
        Shuffle(shuffledCandidates);
        var optionComparer =
            direction == QuestionDirection.EnglishToTurkish
                ? TurkishComparer
                : StringComparer.OrdinalIgnoreCase;

        foreach (var candidate in shuffledCandidates)
        {
            if (wrongOptions.Count == 3)
                return;

            if (string.Equals(candidate.English, sourceEnglish, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var candidateTranslations = translationsByEnglish[candidate.English];
            if (
                candidateTranslations.Count == 0
                || candidateTranslations.Any(usedTranslations.Contains)
            )
            {
                continue;
            }

            var option =
                direction == QuestionDirection.EnglishToTurkish
                    ? FormatTranslations(candidate.TurkishTranslations)
                    : candidate.English.Trim();

            if (
                option.Length == 0
                || wrongOptions.Any(existing => optionComparer.Equals(existing, option))
            )
            {
                continue;
            }

            wrongOptions.Add(option);
            usedTranslations.UnionWith(candidateTranslations);
        }
    }

    private static string FormatTranslations(IEnumerable<string> translations)
    {
        return string.Join(
            ", ",
            translations
                .Select(translation => translation.Trim())
                .Where(translation => translation.Length > 0)
        );
    }

    private static string NormalizeTurkish(string value)
    {
        return NormalizeAnswer(value);
    }

    private static void Shuffle<T>(IList<T> items)
    {
        for (var index = items.Count - 1; index > 0; index--)
        {
            var swapIndex = Random.Shared.Next(index + 1);
            (items[index], items[swapIndex]) = (items[swapIndex], items[index]);
        }
    }
}

public sealed record QuestionSnapshot(
    string Prompt,
    string CorrectAnswer,
    string[]? AcceptedAnswers
);

public sealed record GeneratedQuestion(string[] Options, int CorrectIndex);
