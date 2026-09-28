import { useCallback, useEffect, useState } from 'react';
import { getAlerts, getBeds, getMedicineStock, getPhcs, getStateSummary } from '../services/api.js';

function useDashboardData({ includeStateSummary = true } = {}) {
  const [selectedState, setSelectedState] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stock, setStock] = useState([]);
  const [beds, setBeds] = useState([]);
  const [phcs, setPhcs] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  const refresh = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    if (reloadKey === 0) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError('');

    Promise.all([
      includeStateSummary ? getStateSummary() : Promise.resolve([]),
      getAlerts(),
      getMedicineStock(),
      getBeds(),
      getPhcs(),
    ])
      .then(([nextSummary, nextAlerts, nextStock, nextBeds, nextPhcs]) => {
        if (ignore) {
          return;
        }
        setSummary(nextSummary);
        setAlerts(nextAlerts);
        setStock(nextStock);
        setBeds(nextBeds);
        setPhcs(nextPhcs);
        setDataVersion((current) => current + 1);
      })
      .catch((requestError) => {
        if (!ignore) {
          setError(requestError.message || 'The health grid API is unavailable.');
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [includeStateSummary, reloadKey]);

  return {
    selectedState,
    setSelectedState,
    loading,
    refreshing,
    error,
    summary,
    alerts,
    stock,
    beds,
    phcs,
    refresh,
    dataVersion,
  };
}

export { useDashboardData };
