namespace WordMatch.API.Bootstrap;

public sealed class WordBootstrapValidationException(string message)
    : InvalidOperationException(message);
