import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../api/axios";

interface RegisterForm {
  fullName: string;
  email: string;
  password: string;
}

interface ApiErrorResponse {
  error?: string | string[];
}

function Register() {
  const [formData, setFormData] = useState<RegisterForm>({
    fullName: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    try {
      await api.post("/auth/register", formData);

      setSuccess("Account created successfully! Redirecting...");

      setTimeout(() => {
        navigate("/dashboard");
      }, 1200);
    } catch (err: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(err)) {
        const backendError = err.response?.data?.error;

        setError(
          Array.isArray(backendError)
            ? backendError.join(", ")
            : backendError || "Something went wrong",
        );
      } else {
        setError("Something went wrong");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-semibold text-white mb-6">
          Create Account
        </h2>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-300">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="fullName"
            placeholder="Full name"
            className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/40"
            value={formData.fullName}
            onChange={handleChange}
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/40"
            value={formData.email}
            onChange={handleChange}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/40"
            value={formData.password}
            onChange={handleChange}
          />

          <button
            type="submit"
className="w-full py-2 rounded-lg bg-[#9f7c55] text-white font-medium hover:bg-[#c19a6b] hover:shadow-lg transition-all duration-200"          >
            Register
          </button>
        </form>

        <p className="text-white/70 text-sm mt-6 text-center">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-white underline hover:text-white/80"
          >
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
