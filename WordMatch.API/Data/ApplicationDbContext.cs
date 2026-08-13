using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WordMatch.API.Features.Auth;
using WordMatch.API.Features.Practice;
using WordMatch.API.Features.Words;

namespace WordMatch.API.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Word> Words => Set<Word>();

    public DbSet<PracticeSession> PracticeSessions => Set<PracticeSession>();

    public DbSet<PracticeSessionWord> PracticeSessionWords => Set<PracticeSessionWord>();

    public DbSet<UserWordProgress> UserWordProgress => Set<UserWordProgress>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
