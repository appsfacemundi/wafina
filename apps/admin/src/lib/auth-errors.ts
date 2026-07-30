/** Maps Firebase Auth error codes to Portuguese, user-facing messages. */
export function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou palavra-passe incorretos.';
    case 'auth/too-many-requests':
      return 'Demasiadas tentativas. Tente novamente mais tarde.';
    default:
      return 'Não foi possível concluir. Tente novamente.';
  }
}
