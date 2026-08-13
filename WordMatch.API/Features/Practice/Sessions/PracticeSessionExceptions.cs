namespace WordMatch.API.Features.Practice;

public class PracticeValidationException(string message) : Exception(message);

public class PracticeNotFoundException : Exception;

public class PracticeConflictException(string message) : Exception(message);
