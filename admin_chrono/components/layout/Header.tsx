'use client'

import { Search, Filter, Bell, Calendar } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const [query, setQuery] = useState('')

  return (
    <div className="
      bg-white
      shadow-sm
      border
      border-gray-100
      rounded-2xl
      px-8 py-4
      flex items-center justify-between
      mb-6
    ">
      
      {/* Search bar */}
      <div className="flex-1 max-w-xl relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search orders, drivers, customers..."
          className="
            w-full pl-12 pr-12 py-3
            bg-[#F5F6FA]
            rounded-xl
            focus:outline-none
            focus:ring-2 focus:ring-purple-500
            text-sm
          "
        />
        <button className="absolute right-4 top-1/2 -translate-y-1/2">
          <Filter className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-6 ml-8">
        <button className="flex items-center gap-2 px-4 py-2 bg-[#F5F6FA] rounded-xl text-gray-700">
          <Calendar className="w-5 h-5" />
          <span className="text-sm">Ce mois</span>
        </button>

        <div className="text-sm text-gray-700">11 December 2024</div>

        <button className="px-5 py-2 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700">
          + New Shipping
        </button>

        <button className="relative p-2 rounded-xl hover:bg-gray-100">
          <Bell className="w-6 h-6 text-gray-700" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
      </div>
    </div>
  )
}
