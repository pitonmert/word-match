namespace WordMatch.API.Features.Words;

// Entity Framework maps this class to the Words table.
public class Word
{
    public int Id { get; set; }

    // Accepted Turkish answers for this English word and part of speech.
    public string[] TurkishTranslations { get; set; } = [];

    // The English word shown as the question prompt.
    public required string English { get; set; }

    public required WordPartOfSpeech PartOfSpeech { get; set; }

    public string? PastSimple { get; set; }

    public string? PastParticiple { get; set; }

    public bool IsIrregular { get; set; }

    public required WordLevel Level { get; set; }

    public required WordTopic Topic { get; set; }
}
