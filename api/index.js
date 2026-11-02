export default function handler(req, res) {
  const url = req.url;

  // Handle Admin Requests
  if (url.startsWith('/api/admin') || url.startsWith('/admin')) {
    if (url.includes('/login')) {
      return res.status(200).json({ success: true, message: "Admin Login Success" });
    }
    if (url.includes('/dashboard')) {
      return res.status(200).json({ success: true, message: "Admin Dashboard Access" });
    }
    return res.status(200).json({ message: "Admin Base API" });
  }

  // Handle Customer / Product Requests
  if (url.startsWith('/api/customer')) {
    return res.status(200).json({ success: true, message: "Customer Account API Active" });
  }

  // Default Route
  return res.status(200).json({ message: "ZOHD API Server Operational" });
}