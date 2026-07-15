import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

export default function useOwners() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOwners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/owners");
      setOwners(res.data.owners);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load owners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  return { owners, loading, error, refetch: fetchOwners };
}