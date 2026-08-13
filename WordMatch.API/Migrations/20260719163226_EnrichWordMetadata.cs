using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class EnrichWordMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Turkish",
                table: "Words",
                newName: "TurkishTranslation"
            );

            migrationBuilder.AddColumn<bool>(
                name: "IsIrregular",
                table: "Words",
                type: "boolean",
                nullable: false,
                defaultValue: false
            );

            migrationBuilder.AddColumn<string>(
                name: "PartOfSpeech",
                table: "Words",
                type: "text",
                nullable: false,
                defaultValue: "Noun"
            );

            migrationBuilder.AddColumn<string>(
                name: "PastParticiple",
                table: "Words",
                type: "text",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "PastSimple",
                table: "Words",
                type: "text",
                nullable: true
            );

            migrationBuilder.Sql(
                "ALTER TABLE \"Words\" ALTER COLUMN \"PartOfSpeech\" DROP DEFAULT;"
            );

            migrationBuilder.Sql(
                "ALTER TABLE \"Words\" ALTER COLUMN \"IsIrregular\" DROP DEFAULT;"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_Words_PartOfSpeech",
                table: "Words",
                sql: "\"PartOfSpeech\" IN ('Verb', 'Noun', 'Adjective', 'ProperNoun')"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_Words_VerbMetadata",
                table: "Words",
                sql: "(\"PartOfSpeech\" = 'Verb' AND \"PastSimple\" IS NOT NULL AND \"PastParticiple\" IS NOT NULL) OR (\"PartOfSpeech\" <> 'Verb' AND \"PastSimple\" IS NULL AND \"PastParticiple\" IS NULL AND NOT \"IsIrregular\")"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(name: "CK_Words_PartOfSpeech", table: "Words");

            migrationBuilder.DropCheckConstraint(name: "CK_Words_VerbMetadata", table: "Words");

            migrationBuilder.DropColumn(name: "IsIrregular", table: "Words");

            migrationBuilder.DropColumn(name: "PartOfSpeech", table: "Words");

            migrationBuilder.DropColumn(name: "PastParticiple", table: "Words");

            migrationBuilder.DropColumn(name: "PastSimple", table: "Words");

            migrationBuilder.RenameColumn(
                name: "TurkishTranslation",
                table: "Words",
                newName: "Turkish"
            );
        }
    }
}
