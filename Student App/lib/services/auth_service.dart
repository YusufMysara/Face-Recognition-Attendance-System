import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/api_config.dart';
import '../models/user.dart';

class AuthService {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  final Dio _dio = Dio(
    BaseOptions(
      baseUrl: ApiConfig.getBaseUrl(),
      connectTimeout: Duration(milliseconds: ApiConfig.connectTimeout),
      receiveTimeout: Duration(milliseconds: ApiConfig.receiveTimeout),
    ),
  );

  static const String _accessTokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userKey = 'user_data';

  /// Login with email and password
  Future<AuthResponse> login(String email, String password) async {
    try {
      final response = await _dio.post(
        ApiConfig.login,
        data: {'email': email, 'password': password},
      );

      final authResponse = AuthResponse.fromJson(response.data);

      // Check if user is a student
      if (authResponse.user.role != 'student') {
        throw Exception('Access denied. This app is for students only.');
      }

      // Store tokens securely
      await _saveTokens(authResponse.token.accessToken, ''); // No refresh token in backend

      // Store user data
      await _secureStorage.write(key: _userKey, value: authResponse.user.id.toString());

      return authResponse;
    } on DioException catch (e) {
      if (e.response?.statusCode == 400) {
        throw Exception('Invalid credentials');
      } else {
        throw Exception('Login failed: ${e.message}');
      }
    } catch (e) {
      throw Exception('Login failed: $e');
    }
  }

  /// Logout and clear stored tokens
  Future<void> logout() async {
    // Backend doesn't have logout endpoint, just clear local storage
    await _secureStorage.delete(key: _accessTokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await _secureStorage.delete(key: _userKey);
  }

  /// Get current user ID
  Future<int?> getCurrentUserId() async {
    final userIdStr = await _secureStorage.read(key: _userKey);
    return userIdStr != null ? int.tryParse(userIdStr) : null;
  }

  /// Check if user is authenticated
  Future<bool> isAuthenticated() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }

  /// Get stored access token
  Future<String?> getAccessToken() async {
    return await _secureStorage.read(key: _accessTokenKey);
  }

  /// Get stored refresh token
  Future<String?> getRefreshToken() async {
    return await _secureStorage.read(key: _refreshTokenKey);
  }

  /// Refresh the access token.
  ///
  /// The backend issues 12-hour JWTs and has no refresh-token endpoint.
  /// When a token expires the user must log in again — return null so callers
  /// know to redirect to the login screen instead of retrying with a bad token.
  Future<String?> refreshAccessToken() async {
    return null;
  }

  /// Save tokens securely
  Future<void> _saveTokens(String accessToken, String refreshToken) async {
    await _secureStorage.write(key: _accessTokenKey, value: accessToken);
    await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);
  }
}
