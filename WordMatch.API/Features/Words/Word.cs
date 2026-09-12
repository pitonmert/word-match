namespace WordMatch.API.Features.Words;

public class Word
{
    public int Id { get; set; }

    public required string English { get; set; }

    public string[] TurkishTranslations { get; set; } = [];

    public required WordPartOfSpeech PartOfSpeech { get; set; }

    public string? PastSimple { get; set; }

    public string? PastParticiple { get; set; }

    public bool IsIrregular { get; set; }

    public required WordLevel Level { get; set; }

    public required WordTopic Topic { get; set; }

    public string ImportKey { get; set; } = Guid.NewGuid().ToString("N");
}

public enum WordLevel
{
    A1,
    A2,
    B1,
    B2,
}

public enum WordPartOfSpeech
{
    Verb,
    Noun,
    Adjective,
    ProperNoun,
    Number,
    Pronoun,
}

public enum WordTopic
{
    Actions,
    Animals,
    ArtsAndEntertainment,
    BodyAndHealth,
    CalendarAndTime,
    Clothing,
    Colors,
    Countries,
    Days,
    Descriptions,
    Education,
    EmotionsAndPersonality,
    FamilyAndPeople,
    FoodAndDrink,
    General,
    HomeAndObjects,
    JobsAndWork,
    Months,
    NatureAndWeather,
    Numbers,
    Places,
    ShoppingAndMoney,
    SocietyAndPolitics,
    SportsAndLeisure,
    TechnologyAndMedia,
    Transportation,
    TravelAndHolidays,
}
