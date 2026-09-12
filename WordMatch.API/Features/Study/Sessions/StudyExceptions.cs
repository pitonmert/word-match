namespace WordMatch.API.Features.Study;

public sealed class StudyValidationException(string message) : Exception(message);

public sealed class StudyConflictException(string message, string? code = null) : Exception(message)
{
    public string? Code { get; } = code;
}

public sealed class StudyNotFoundException : Exception;
