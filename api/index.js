export default function handler(req, res) {
  const url = req.url;

  // --- ADMIN ROUTES ---
  if (url.includes('/admin/login')) {
    return res.status(200).json({ success: true, message: "Admin Login Endpoint" });
  }
  
  if (url.includes('/admin/dashboard')) {
    return res.status(200).json({ success: true, message: "Admin Dashboard Endpoint" });
  }

  // --- CUSTOMER API ROUTES ---
  if (url.includes('/customer')) {
    return res.status(200).json({ success: true, message: "Customer Account API Active" });
  }

  // Default Fallback
  return res.status(200).json({ message: "API Server running successfully" });
}