using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class UseSharedQuestionProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE "PracticeSessions"
                SET "Status" = 'Abandoned',
                    "LastActivityAtUtc" = CURRENT_TIMESTAMP
                WHERE "Status" = 'Active';
                """
            );

            migrationBuilder.DropColumn(name: "CategoryKey", table: "PracticeSessions");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CategoryKey",
                table: "PracticeSessions",
                type: "character varying(160)",
                maxLength: 160,
                nullable: false,
                defaultValue: ""
            );
        }
    }
}
