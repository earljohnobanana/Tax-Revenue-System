import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

export default function useDelinquentAccounts() {
  const [delinquentAccounts, setDelinquentAccounts] = useState([]);
  const [summary, setSummary] = useState({
    count: 0,
    totalBaseTaxDue: 0,
    totalWithInterest: 0,
    interestRate: 0.25,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDelinquent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/delinquent");
      setDelinquentAccounts(res.data.delinquentAccounts);
      setSummary(res.data.summary);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load delinquent accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDelinquent();
  }, [fetchDelinquent]);

  return { delinquentAccounts, summary, loading, error, refetch: fetchDelinquent };
}