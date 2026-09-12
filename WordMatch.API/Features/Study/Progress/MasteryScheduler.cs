namespace WordMatch.API.Features.Study;

public static class MasteryScheduler
{
    private static readonly TimeSpan[] ReviewIntervals =
    [
        TimeSpan.FromDays(1),
        TimeSpan.FromDays(3),
        TimeSpan.FromDays(7),
        TimeSpan.FromDays(14),
        TimeSpan.FromDays(30),
    ];

    public static void Apply(UserWordMastery mastery, StudyOutcome outcome, DateTimeOffset now)
    {
        mastery.LastOutcome = outcome;
        mastery.LastStudiedAtUtc = now;
        if (outcome == StudyOutcome.Correct)
        {
            mastery.Stage = Math.Min(5, mastery.Stage + 1);
            mastery.ConsecutiveCorrectCount++;
            mastery.CorrectCount++;
            mastery.NextReviewAtUtc = now + ReviewIntervals[mastery.Stage - 1];
            return;
        }

        mastery.Stage = 0;
        mastery.ConsecutiveCorrectCount = 0;
        mastery.NextReviewAtUtc = now + TimeSpan.FromMinutes(10);
        if (outcome == StudyOutcome.Review)
            mastery.ReviewCount++;
        else
            mastery.WrongCount++;
    }
}
