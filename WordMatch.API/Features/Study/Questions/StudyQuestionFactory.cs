using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Study;

public sealed class StudyQuestionFactory(QuestionFactory questionFactory)
{
    public StudyQuestionSnapshot Create(
        Word word,
        VocabularyMasteryDimension dimension,
        IReadOnlyCollection<Word> allWords
    )
    {
        return dimension switch
        {
            VocabularyMasteryDimension.WrittenRecognition => CreateRecognition(word, allWords),
            VocabularyMasteryDimension.WrittenRecall => CreateRecall(word, allWords),
            _ => throw new StudyConflictException("Bu Study odağı henüz desteklenmiyor."),
        };
    }

    public bool IsWrittenAnswerCorrect(string answer, IReadOnlyCollection<string> acceptedAnswers)
    {
        return questionFactory.IsWrittenAnswerCorrect(
            QuestionDirection.TurkishToEnglish,
            answer,
            acceptedAnswers
        );
    }

    private StudyQuestionSnapshot CreateRecognition(Word word, IReadOnlyCollection<Word> allWords)
    {
        var snapshot = questionFactory.CreateSnapshot(
            word,
            QuestionDirection.EnglishToTurkish,
            QuestionFormat.MultipleChoice,
            allWords
        );
        GeneratedQuestion generated;
        try
        {
            generated = questionFactory.CreateOptions(
                word.English,
                QuestionDirection.EnglishToTurkish,
                snapshot.CorrectAnswer,
                allWords,
                [
                    allWords.Where(candidate => candidate.Topic == word.Topic),
                    allWords.Where(candidate => candidate.Level == word.Level),
                    allWords,
                ]
            );
        }
        catch (QuestionValidationException exception)
        {
            throw new StudyValidationException(exception.Message);
        }

        return new StudyQuestionSnapshot(
            StudyQuestionKind.MultipleChoice,
            snapshot.Prompt,
            snapshot.CorrectAnswer,
            generated.Options,
            generated.CorrectIndex,
            null
        );
    }

    private StudyQuestionSnapshot CreateRecall(Word word, IReadOnlyCollection<Word> allWords)
    {
        var snapshot = questionFactory.CreateSnapshot(
            word,
            QuestionDirection.TurkishToEnglish,
            QuestionFormat.Written,
            allWords
        );
        return new StudyQuestionSnapshot(
            StudyQuestionKind.Written,
            snapshot.Prompt,
            snapshot.CorrectAnswer,
            null,
            null,
            snapshot.AcceptedAnswers
        );
    }
}

public sealed record StudyQuestionSnapshot(
    StudyQuestionKind Kind,
    string Prompt,
    string CorrectAnswer,
    string[]? Options,
    int? CorrectIndex,
    string[]? AcceptedAnswers
);
