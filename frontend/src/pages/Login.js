import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { authService } from "../services/api";
const LoginPage = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            setError(null);
            const response = await authService.login(email, password);
            login({ user: response.user, token: response.token.access_token });
        }
        catch (err) {
            setError("Invalid credentials");
        }
    };
    return (_jsxs("div", { style: { maxWidth: 400, margin: "2rem auto" }, children: [_jsx("h2", { children: "Login" }), _jsxs("form", { onSubmit: handleSubmit, style: { display: "flex", flexDirection: "column", gap: "1rem" }, children: [_jsx("input", { placeholder: "Email", value: email, onChange: (e) => setEmail(e.target.value) }), _jsx("input", { placeholder: "Password", type: "password", value: password, onChange: (e) => setPassword(e.target.value) }), _jsx("button", { type: "submit", children: "Sign in" })] }), error && _jsx("p", { style: { color: "red" }, children: error })] }));
};
export default LoginPage;
