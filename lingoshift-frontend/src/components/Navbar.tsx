import { NavLink, useNavigate } from "react-router-dom";
import api from "../api/axios";

import { useEffect, useState } from "react";
import { CgProfile } from "react-icons/cg";

function Navbar() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    id: "",
    fullName: "",
    email: "",
  });

  useEffect(() => {
    const getUser = async () => {
      try {
        const res = await api.get("/auth/me");
        setFormData(res.data);
      } catch (error) {
        console.log("User not authenticated");
      }
    };

    getUser();
  }, []);

  const handleLogout = async (): Promise<void> => {
    await api.post("/auth/logout");
    navigate("/login");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `relative text-50 transition duration-300 pb-1
    ${isActive ? "text-[#9f7c55]" : "text-[#9f7c55] hover:text-[#c19a6b]"}
    after:absolute after:left-1/2 after:-translate-x-1/2
    after:bottom-0 after:h-[2px] after:bg-[#c19a6b]
    after:transition-all after:duration-300
    ${isActive ? "after:w-full" : "after:w-0 hover:after:w-full"}`;

  return (
    <nav className="relative w-full bg-white/10 backdrop-blur-lg border-b border-white/20 px-6 py-4 flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-2">
        
        <span className="text-white font-semibold text-lg">LingoShift</span>
      </div>

      {/* Navigation */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-10">
        <NavLink to="/dashboard" className={navLinkClass} >
          Translate
        </NavLink>

        <NavLink to="/projects" className={navLinkClass}>
          Projects
        </NavLink>

        <NavLink to="/history" className={navLinkClass}>
          History
        </NavLink>
      </div>

      {/* User */}
      <div className="flex items-center gap-5">
        <span className="text-white/90 text-sm font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
          <CgProfile size={20} />
          {formData.fullName ? `Welcome, ${formData.fullName}` : "Loading..."}
        </span>

        <button
          onClick={handleLogout}
          className="px-4 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
