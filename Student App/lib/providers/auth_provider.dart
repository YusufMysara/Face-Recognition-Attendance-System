import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/auth_service.dart';

final authServiceProvider = Provider<AuthService>((ref) => AuthService());

final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final authService = ref.watch(authServiceProvider);
  return AuthNotifier(authService);
});

class AuthState {
  final bool isLoading;
  final bool isAuthenticated;

  AuthState({
    this.isLoading = false,
    this.isAuthenticated = false,
  });

  AuthState copyWith({
    bool? isLoading,
    bool? isAuthenticated,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(AuthState());

  Future<void> checkAuthStatus() async {
    state = state.copyWith(isLoading: true);

    try {
      final isAuthenticated = await _authService.isAuthenticated();
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: isAuthenticated,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, isAuthenticated: false);
    }
  }

  /// Attempts login. Returns normally on success; rethrows on failure so the
  /// UI can display a specific error message without storing it in global state.
  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true);

    try {
      await _authService.login(email, password);
      state = state.copyWith(isLoading: false, isAuthenticated: true);
    } catch (e) {
      state = state.copyWith(isLoading: false, isAuthenticated: false);
      rethrow;
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true);

    try {
      await _authService.logout();
      state = AuthState();
    } catch (e) {
      state = state.copyWith(isLoading: false);
    }
  }
}
