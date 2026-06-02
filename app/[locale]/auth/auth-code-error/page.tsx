import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[--color-background]">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">No se pudo completar el acceso</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 text-center max-w-md">
        El enlace de autenticación no es válido o ha caducado. Vuelve a intentar iniciar sesión.
      </p>
      <Link
        href="/login"
        className="mt-6 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        Volver al inicio de sesión
      </Link>
    </div>
  )
}
