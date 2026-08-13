using WordMatch.API.Features.Words;

namespace WordMatch.API.Features.Practice.Categories;

public interface ICategoryService
{
    Task<CategoryResponse> GetCategoriesAsync(string userId, CancellationToken cancellationToken);

    Task<bool> ResetProgressAsync(
        string userId,
        WordLevel level,
        WordTopic topic,
        CancellationToken cancellationToken
    );
}
