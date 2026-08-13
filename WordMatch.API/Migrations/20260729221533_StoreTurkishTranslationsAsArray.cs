using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class StoreTurkishTranslationsAsArray : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "Words"
                RENAME COLUMN "TurkishTranslation" TO "TurkishTranslations";

                ALTER TABLE "Words"
                ALTER COLUMN "TurkishTranslations" TYPE text[]
                USING regexp_split_to_array(trim("TurkishTranslations"), '\s*,\s*');
                """
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_Words_TurkishTranslations",
                table: "Words",
                sql: "cardinality(\"TurkishTranslations\") > 0 AND array_position(\"TurkishTranslations\", NULL) IS NULL AND array_position(\"TurkishTranslations\", '') IS NULL"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Words_TurkishTranslations",
                table: "Words"
            );

            migrationBuilder.Sql(
                """
                ALTER TABLE "Words"
                ALTER COLUMN "TurkishTranslations" TYPE text
                USING array_to_string("TurkishTranslations", ', ');

                ALTER TABLE "Words"
                RENAME COLUMN "TurkishTranslations" TO "TurkishTranslation";
                """
            );
        }
    }
}
