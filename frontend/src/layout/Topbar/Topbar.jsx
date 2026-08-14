import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LogOut,
  Search,
  Users,
  BedDouble,
  IndianRupee,
  Home,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import "./topbar.css";

const Topbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // ✅ FIX: Use AuthContext
  const { logout } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const searchRef = useRef(null);

  const getPageTitle = () => {
    const path = location.pathname;
    const routes = {
      "/": "Dashboard",
      "/students": "Students",
      "/students/add": "Add Student",
      "/rooms": "Rooms",
      "/fees": "Receive Fee",
      "/ledger": "Ledger",
      "/members": "Members",
      "/fine": "Fine / Advance",
      "/reports": "Reports",
      "/settings": "Settings"
    };
    
    if (path.startsWith("/students/")) return "Student Details";
    if (path.startsWith("/fees/")) return "Fee Details";
    
    return routes[path] || "Dashboard";
  };

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setShowSearchResults(false);
    setSearchQuery("");
  }, [location]);

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const debounce = setTimeout(() => {
        performSearch(searchQuery);
      }, 300);
      return () => clearTimeout(debounce);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  const abortRef = useRef(null);

  const performSearch = async (query) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { studentAPI } = await import("../../services/api/student.api");
      const { feeAPI } = await import("../../services/api/fee.api");
      const { roomAPI } = await import("../../services/api/room.api");

      const signal = controller.signal;
      const [studentsRes, feesRes, roomsRes] = await Promise.all([
        studentAPI.getStudents({ signal }).catch(() => ({ data: { data: [] }})),
        feeAPI.getAllFees({ signal }).catch(() => ({ data: { data: [] }})),
        roomAPI.getAllRooms({ signal }).catch(() => ({ data: { data: [] }}))
      ]);

      if (controller.signal.aborted) return;

      const students = studentsRes.data.data || [];
      const fees = feesRes.data.data || [];
      const rooms = roomsRes.data.data || [];

      const queryLower = query.toLowerCase();

      const studentResults = students
        .filter(s => s.student_name?.toLowerCase().includes(queryLower))
        .slice(0, 3)
        .map(s => ({ ...s, type: "STUDENT" }));

      const feeResults = fees
        .filter(f => f.student_name?.toLowerCase().includes(queryLower))
        .slice(0, 3)
        .map(f => ({ ...f, type: "FEE" }));

      const roomResults = rooms
        .filter(r => r.room_no?.toString().includes(query))
        .slice(0, 2)
        .map(r => ({ ...r, type: "ROOM" }));

      setSearchResults([...studentResults, ...feeResults, ...roomResults]);
      setShowSearchResults(true);
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') return;
      console.error("Search error:", error);
    }
  };

  // ✅ FIX: Use logout from AuthContext
  const handleLogout = () => {
    logout();
  };

  const handleSearchResultClick = (result) => {
    if (result.type === "STUDENT") {
      navigate(`/students?search=${encodeURIComponent(result.student_name)}`);
    } else if (result.type === "ROOM") {
      navigate("/rooms");
    } else if (result.type === "FEE") {
      navigate(`/fees?search=${encodeURIComponent(result.student_name)}`);
    }
    setSearchQuery("");
    setShowSearchResults(false);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button 
          className="home-btn" 
          onClick={() => navigate('/')}
          title="Dashboard"
        >
          <Home size={20} />
        </button>
        <h2 className="page-title">{getPageTitle()}</h2>
      </div>

      <div className="topbar-right">
        {/* Search */}
        <div className="search-container" ref={searchRef}>
          <div className="search-input">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search students, rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {showSearchResults && searchResults.length > 0 && (
            <div className="search-results-dropdown" aria-live="polite">
              {searchResults.map((result, index) => (
                <div
                  key={`${result.type}-${index}`}
                  className="search-result-item"
                  onClick={() => handleSearchResultClick(result)}
                >
                  {result.type === "STUDENT" && (
                    <>
                      <Users size={16} />
                      <div className="result-info">
                        <span className="result-name">{result.student_name}</span>
                        <span className="result-detail">
                          Student • Room {result.room_no || 'N/A'}
                        </span>
                      </div>
                    </>
                  )}
                  {result.type === "FEE" && (
                    <>
                      <IndianRupee size={16} />
                      <div className="result-info">
                        <span className="result-name">{result.student_name}</span>
                        <span className="result-detail">
                          Fee • ₹{result.fee_amount?.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </>
                  )}
                  {result.type === "ROOM" && (
                    <>
                      <BedDouble size={16} />
                      <div className="result-info">
                        <span className="result-name">Room {result.room_no}</span>
                        <span className="result-detail">
                          {result.room_type} • {result.available_beds} beds available
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {showSearchResults && searchQuery.length > 1 && searchResults.length === 0 && (
            <div className="search-results-dropdown">
              <div className="notification-item empty">
                <Search size={32} color="#d1d5db" />
                <p>No results found</p>
              </div>
            </div>
          )}
        </div>

        {/* Logout Button */}
        <button
          className="icon-btn logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Topbar;