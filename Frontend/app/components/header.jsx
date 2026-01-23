export default function Header() {
  return (
    <header className="w-full px-8 py-4 bg-zinc-900 shadow-md flex items-center justify-between">
      <h1 className="text-2xl font-bold text-white">Voxcribe</h1>
      <nav>
        <ul className="flex space-x-4">
          <li>
            <a href="/" className="text-zinc-300 hover:text-white transition">
              Home                          
            </a>
          </li>                         
          <li>
            <a href="/auth/login" className="text-zinc-300 hover:text-white transition">
              Login
            </a>
          </li>
          <li>
            <a href="/auth/signup" className="text-zinc-300 hover:text-white transition">
              Sign Up
            </a>
          </li>
        </ul>
      </nav>
    </header>
  )
}
