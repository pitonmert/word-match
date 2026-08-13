using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class EnforcePracticeStateConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "CK_UserWordProgress_LastOutcome",
                table: "UserWordProgress",
                sql: "\"LastOutcome\" IN ('Correct', 'Review', 'Wrong')"
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_PracticeSessions_Status",
                table: "PracticeSessions",
                sql: "\"Status\" IN ('Active', 'Completed', 'Abandoned')"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_UserWordProgress_LastOutcome",
                table: "UserWordProgress"
            );

            migrationBuilder.DropCheckConstraint(
                name: "CK_PracticeSessions_Status",
                table: "PracticeSessions"
            );
        }
    }
}
