import { Link } from "react-router-dom";
import "../styles/NotFound.css";
export default function NotFound() { return <div className="not-found"><p className="eyebrow">Not found</p><h1>404</h1><p>That page does not exist or has moved.</p><Link className="btn btn-primary" to="/">Go to home</Link></div>; }
