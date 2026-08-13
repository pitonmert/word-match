using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class AlignWordsWithCsv : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(name: "CK_Words_PartOfSpeech", table: "Words");

            migrationBuilder.AddColumn<string>(
                name: "Level",
                table: "Words",
                type: "text",
                nullable: false,
                defaultValue: "A1"
            );

            migrationBuilder.AddColumn<string>(
                name: "Topic",
                table: "Words",
                type: "text",
                nullable: false,
                defaultValue: "General"
            );

            migrationBuilder.Sql("ALTER TABLE \"Words\" ALTER COLUMN \"Level\" DROP DEFAULT;");

            migrationBuilder.Sql("ALTER TABLE \"Words\" ALTER COLUMN \"Topic\" DROP DEFAULT;");

            migrationBuilder.CreateIndex(
                name: "IX_Words_English_PartOfSpeech",
                table: "Words",
                columns: new[] { "English", "PartOfSpeech" },
                unique: true
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_Words_Level",
                table: "Words",
                sql: "\"Level\" IN ('A1', 'A2', 'B1', 'B2')"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_Words_PartOfSpeech",
                table: "Words",
                sql: "\"PartOfSpeech\" IN ('Verb', 'Noun', 'Adjective', 'ProperNoun', 'Number', 'Pronoun')"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_Words_Topic",
                table: "Words",
                sql: "\"Topic\" IN ('Actions', 'Animals', 'ArtsAndEntertainment', 'BodyAndHealth', 'CalendarAndTime', 'Clothing', 'Colors', 'Countries', 'Days', 'Descriptions', 'Education', 'EmotionsAndPersonality', 'FamilyAndPeople', 'FoodAndDrink', 'General', 'HomeAndObjects', 'JobsAndWork', 'Months', 'NatureAndWeather', 'Numbers', 'Places', 'ShoppingAndMoney', 'SocietyAndPolitics', 'SportsAndLeisure', 'TechnologyAndMedia', 'Transportation', 'TravelAndHolidays')"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Words_English_PartOfSpeech", table: "Words");

            migrationBuilder.DropCheckConstraint(name: "CK_Words_Level", table: "Words");

            migrationBuilder.DropCheckConstraint(name: "CK_Words_PartOfSpeech", table: "Words");

            migrationBuilder.DropCheckConstraint(name: "CK_Words_Topic", table: "Words");

            migrationBuilder.DropColumn(name: "Level", table: "Words");

            migrationBuilder.DropColumn(name: "Topic", table: "Words");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Words_PartOfSpeech",
                table: "Words",
                sql: "\"PartOfSpeech\" IN ('Verb', 'Noun', 'Adjective', 'ProperNoun')"
            );
        }
    }
}
