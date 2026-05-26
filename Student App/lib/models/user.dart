class User {
  final int id;
  final String email;
  final String name;
  final String role;
  final String? group;
  final String? photoPath;
  final bool passwordChanged;

  User({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.group,
    this.photoPath,
    this.passwordChanged = false,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      email: json['email'] as String,
      name: json['name'] as String,
      role: json['role'] as String,
      group: json['group'] as String?,
      photoPath: json['photo_path'] as String?,
      passwordChanged: json['password_changed'] as bool? ?? false,
    );
  }

}

class Token {
  final String accessToken;
  final String tokenType;

  Token({
    required this.accessToken,
    required this.tokenType,
  });

  factory Token.fromJson(Map<String, dynamic> json) {
    return Token(
      accessToken: json['access_token'] as String,
      tokenType: json['token_type'] as String,
    );
  }
}

class AuthResponse {
  final User user;
  final Token token;

  AuthResponse({
    required this.user,
    required this.token,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      user: User.fromJson(json['user'] as Map<String, dynamic>),
      token: Token.fromJson(json['token'] as Map<String, dynamic>),
    );
  }
}
