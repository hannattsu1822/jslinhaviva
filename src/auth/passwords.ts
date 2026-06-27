import bcrypt from "bcrypt";

export function validarPoliticaSenha(senha: unknown): void {
  if (!senha || typeof senha !== "string" || senha.length < 8) {
    throw new Error("A senha deve ter no mínimo 8 caracteres.");
  }
  if (!/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) {
    throw new Error("A senha deve conter letras e números.");
  }
}

export async function criarHashSenha(senha: string): Promise<string> {
  validarPoliticaSenha(senha);
  return bcrypt.hash(senha, 10);
}

export async function verificarSenha(
  senhaDigitada: string,
  hashArmazenado: string
): Promise<boolean> {
  return bcrypt.compare(senhaDigitada, hashArmazenado);
}
