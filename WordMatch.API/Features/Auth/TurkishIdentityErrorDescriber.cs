using Microsoft.AspNetCore.Identity;

namespace WordMatch.API.Features.Auth;

public sealed class TurkishIdentityErrorDescriber : IdentityErrorDescriber
{
    public override IdentityError DefaultError() =>
        Error(nameof(DefaultError), "Beklenmeyen bir hata oluştu.");

    public override IdentityError ConcurrencyFailure() =>
        Error(nameof(ConcurrencyFailure), "Kayıt başka bir işlem tarafından değiştirildi.");

    public override IdentityError PasswordMismatch() =>
        Error(nameof(PasswordMismatch), "Parola hatalı.");

    public override IdentityError InvalidToken() =>
        Error(nameof(InvalidToken), "Geçersiz işlem anahtarı.");

    public override IdentityError LoginAlreadyAssociated() =>
        Error(
            nameof(LoginAlreadyAssociated),
            "Bu giriş bilgisi başka bir hesapla ilişkilendirilmiş."
        );

    public override IdentityError InvalidUserName(string? userName) =>
        Error(nameof(InvalidUserName), $"'{userName}' kullanıcı adı geçersiz.");

    public override IdentityError InvalidEmail(string? email) =>
        Error(nameof(InvalidEmail), $"'{email}' e-posta adresi geçersiz.");

    public override IdentityError InvalidRoleName(string? role) =>
        Error(nameof(InvalidRoleName), $"'{role}' rol adı geçersiz.");

    public override IdentityError DuplicateUserName(string userName) =>
        Error(nameof(DuplicateUserName), $"'{userName}' kullanıcı adı zaten kullanılıyor.");

    public override IdentityError DuplicateEmail(string email) =>
        Error(nameof(DuplicateEmail), $"'{email}' e-posta adresi zaten kullanılıyor.");

    public override IdentityError DuplicateRoleName(string role) =>
        Error(nameof(DuplicateRoleName), $"'{role}' rol adı zaten kullanılıyor.");

    public override IdentityError PasswordTooShort(int length) =>
        Error(nameof(PasswordTooShort), $"Parola en az {length} karakter olmalıdır.");

    public override IdentityError PasswordRequiresNonAlphanumeric() =>
        Error(
            nameof(PasswordRequiresNonAlphanumeric),
            "Parola en az bir özel karakter içermelidir."
        );

    public override IdentityError PasswordRequiresDigit() =>
        Error(nameof(PasswordRequiresDigit), "Parola en az bir rakam içermelidir.");

    public override IdentityError PasswordRequiresLower() =>
        Error(nameof(PasswordRequiresLower), "Parola en az bir küçük harf içermelidir.");

    public override IdentityError PasswordRequiresUpper() =>
        Error(nameof(PasswordRequiresUpper), "Parola en az bir büyük harf içermelidir.");

    public override IdentityError PasswordRequiresUniqueChars(int uniqueChars) =>
        Error(
            nameof(PasswordRequiresUniqueChars),
            $"Parola en az {uniqueChars} farklı karakter içermelidir."
        );

    public override IdentityError UserAlreadyHasPassword() =>
        Error(nameof(UserAlreadyHasPassword), "Kullanıcının zaten bir parolası var.");

    public override IdentityError UserLockoutNotEnabled() =>
        Error(nameof(UserLockoutNotEnabled), "Bu kullanıcı için hesap kilitleme etkin değil.");

    public override IdentityError UserAlreadyInRole(string role) =>
        Error(nameof(UserAlreadyInRole), $"Kullanıcı zaten '{role}' rolünde.");

    public override IdentityError UserNotInRole(string role) =>
        Error(nameof(UserNotInRole), $"Kullanıcı '{role}' rolünde değil.");

    public override IdentityError RecoveryCodeRedemptionFailed() =>
        Error(nameof(RecoveryCodeRedemptionFailed), "Kurtarma kodu kullanılamadı.");

    private static IdentityError Error(string code, string description) =>
        new() { Code = code, Description = description };
}
