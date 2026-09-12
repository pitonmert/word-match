namespace WordMatch.API.Bootstrap;

public sealed record ContentBootstrapResult(
    int WordsCreated,
    int WordsAdopted,
    int WordsUpdated,
    int WordsUnchanged,
    int TopicsCreated,
    int TopicsUpdated,
    int TopicsRetired,
    int WordLinksCreated,
    int WordLinksUpdated
);
