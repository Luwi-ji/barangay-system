import { Link, useNavigate } from 'react-router-dom'
import { LogOut, User, Menu, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useState } from 'react'

export default function Navbar({ user, userProfile }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#9333ea' }}>
              <span className="text-white font-bold text-xs sm:text-sm">BRG</span>
            </div>
            <span className="hidden sm:inline font-semibold text-dark-900 text-xs sm:text-base">
              Barangay Document System
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              to="/profile"
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <User className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{userProfile?.full_name || user?.email}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-sm text-white bg-dark-800 hover:bg-accent-600 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <X className="w-6 h-6 text-gray-600" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-3 border-t">
            <div className="pt-4 px-2">
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center space-x-2 text-sm text-gray-600 mb-3 hover:text-gray-900"
              >
                <User className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{userProfile?.full_name || user?.email}</span>
              </Link>
              <button
                onClick={() => {
                  handleLogout()
                  setMenuOpen(false)
                }}
                className="w-full flex items-center justify-center space-x-1 text-sm text-white bg-dark-800 hover:bg-accent-600 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}