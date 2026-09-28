import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp, Button, Card, Result, Skeleton } from 'antd';
import AppLayout from '../layouts/AppLayout.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { getAllFootfall } from '../services/api.js';
import KpiCards from '../components/KpiCards.jsx';
import StateOverview from '../components/StateOverview.jsx';
import AlertPanel from '../components/AlertPanel.jsx';
import MedicineRiskTable from '../components/MedicineRiskTable.jsx';
import BedUtilizationChart from '../components/BedUtilizationChart.jsx';
import FootfallTrendChart from '../components/FootfallTrendChart.jsx';
import AiRiskPanel from '../components/AiRiskPanel.jsx';
import RedistributionPanel from '../components/RedistributionPanel.jsx';
import AiQueryPanel from '../components/AiQueryPanel.jsx';
import DrillBreadcrumb from '../components/DrillBreadcrumb.jsx';
import StateLevelView from '../components/StateLevelView.jsx';
import DistrictLevelView from '../components/DistrictLevelView.jsx';
import PhcDetailView from '../components/PhcDetailView.jsx';
import PhcMap from '../components/PhcMap.jsx';
import DemandForecastPanel from '../components/DemandForecastPanel.jsx';
import EmergencyResponsePanel from '../components/EmergencyResponsePanel.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABEL } from '../auth/roles.js';
import { shortPhcName } from '../utils/format.js';
import './DashboardPage.css';

function inState(row, selectedState) {
  return selectedState === 'all' || row.state === selectedState;
}

function startingPlace(audience, user) {
  if (audience === 'state') {
    return { level: 'state', state: user?.state_name || null, district: null, phcId: null };
  }
  if (audience === 'district') {
    return { level: 'district', state: user?.state_name || null, district: user?.district_name || null, phcId: null };
  }
  if (audience === 'phc') {
    return {
      level: 'phc',
      state: user?.state_name || null,
      district: user?.district_name || null,
      phcId: user?.phc_id || null,
    };
  }
  return { level: 'national', state: null, district: null, phcId: null };
}

const SCOPE_COPY = {
  national: {
    title: 'India',
    detail: 'National operational view across states, districts, and PHCs.',
  },
  state: {
    title: 'Tamil Nadu',
    detail: 'State operational view. Other states are outside this login.',
  },
  district: {
    title: 'Coimbatore',
    detail: 'District operational view. Other districts are outside this login.',
  },
  phc: {
    title: 'Sulur PHC',
    detail: 'PHC operational view for the assigned facility only.',
  },
};

function DashboardPage({ audience = 'national' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
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
  } = useDashboardData({ includeStateSummary: audience === 'national' || audience === 'state' });
  const { message } = AntApp.useApp();
  const [place, setPlace] = useState(() => startingPlace(audience, user));
  const [footfall, setFootfall] = useState([]);
  const [footfallReady, setFootfallReady] = useState(false);
  const [footfallError, setFootfallError] = useState('');

  useEffect(() => {
    if (error && summary.length > 0) {
      message.error(error);
    }
  }, [error, summary.length, message]);

  useEffect(() => {
    if (place.level === 'national') {
      return undefined;
    }
    let ignore = false;
    setFootfallError('');
    getAllFootfall()
      .then((rows) => {
        if (!ignore) {
          setFootfall(Array.isArray(rows) ? rows : []);
          setFootfallReady(true);
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          setFootfallReady(false);
          setFootfallError(requestError.message || 'The health grid API is unavailable.');
        }
      });
    return () => {
      ignore = true;
    };
  }, [place.level === 'national', dataVersion]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [place.level, place.state, place.district, place.phcId]);

  useEffect(() => {
    if (footfallError) {
      message.error(footfallError);
    }
  }, [footfallError, message]);

  const states = useMemo(() => summary.map((row) => row.state), [summary]);
  const visibleSummary = useMemo(
    () => summary.filter((row) => inState(row, selectedState)),
    [summary, selectedState],
  );
  const visibleAlerts = useMemo(
    () => alerts.filter((row) => inState(row, selectedState)),
    [alerts, selectedState],
  );
  const visibleStock = useMemo(
    () => stock.filter((row) => inState(row, selectedState)),
    [stock, selectedState],
  );
  const visibleBeds = useMemo(
    () => beds.filter((row) => inState(row, selectedState)),
    [beds, selectedState],
  );
  const visiblePhcs = useMemo(
    () => phcs.filter((row) => inState(row, selectedState)),
    [phcs, selectedState],
  );

  const kpis = useMemo(() => ({
    totalPhcs: visibleSummary.reduce((sum, row) => sum + row.total_phcs, 0),
    totalPatients: visibleSummary.reduce((sum, row) => sum + row.total_patients, 0),
    availableBeds: visibleSummary.reduce((sum, row) => sum + row.available_beds, 0),
    criticalAlerts: visibleAlerts.filter((alert) => alert.severity === 'CRITICAL').length,
  }), [visibleAlerts, visibleSummary]);

  const asOf = visibleSummary.find((row) => row.attendance_date)?.attendance_date
    || summary.find((row) => row.attendance_date)?.attendance_date
    || null;

  const hasData = summary.length > 0 || alerts.length > 0 || stock.length > 0;
  const currentPhc = phcs.find((phc) => Number(phc.id) === Number(place.phcId));

  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (!id || !hasData) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [hasData, place.level]);

  function openState(stateName) {
    if (audience !== 'national') {
      return;
    }
    setSelectedState(stateName);
    setPlace({ level: 'state', state: stateName, district: null, phcId: null });
  }

  function openDistrict(districtName) {
    setPlace((current) => ({ ...current, level: 'district', district: districtName, phcId: null }));
  }

  function openPhc(phcId) {
    setPlace((current) => ({ ...current, level: 'phc', phcId }));
  }

  function openMappedPhc(point) {
    setPlace({
      level: 'phc',
      state: point.state,
      district: point.district,
      phcId: point.id,
    });
  }

  function onHeaderState(value) {
    if (audience !== 'national') {
      return;
    }
    setSelectedState(value);
    if (value === 'all') {
      setPlace({ level: 'national', state: null, district: null, phcId: null });
      return;
    }
    if (place.level !== 'national') {
      setPlace({ level: 'state', state: value, district: null, phcId: null });
    }
  }

  function onCrumb(key) {
    if (key === 'india') {
      if (audience !== 'national') {
        return;
      }
      setSelectedState('all');
      setPlace({ level: 'national', state: null, district: null, phcId: null });
      return;
    }
    if (key === 'state') {
      if (audience === 'district' || audience === 'phc') {
        return;
      }
      setPlace((current) => ({ ...current, level: 'state', district: null, phcId: null }));
      return;
    }
    if (key === 'district') {
      if (audience === 'phc') {
        return;
      }
      setPlace((current) => ({ ...current, level: 'district', phcId: null }));
    }
  }

  const scopeCopy = audience === 'national'
    ? SCOPE_COPY.national
    : {
      title: user?.scope_label || SCOPE_COPY[audience].title,
      detail: audience === 'state'
        ? `${user?.state_name || 'This state'} operational view. Other states are outside this login.`
        : audience === 'district'
          ? `${user?.district_name || 'This district'} operational view. Other districts are outside this login.`
          : `${user?.scope_label || 'This PHC'} operational view for the assigned facility only.`,
    };
  const crumbs = [];
  if (audience === 'national') {
    crumbs.push({ key: 'india', label: 'India' });
  }
  if (place.state && audience !== 'district' && audience !== 'phc') {
    crumbs.push({ key: 'state', label: place.state });
  }
  if (place.district && audience !== 'phc') {
    crumbs.push({ key: 'district', label: place.district });
  }
  if (place.level === 'phc') {
    crumbs.push({ key: 'phc', label: currentPhc ? shortPhcName(currentPhc.name) : (user?.scope_label || 'PHC') });
  }

  const pageTitle = place.level === 'national'
    ? 'National Dashboard'
    : place.level === 'state'
      ? (place.state || 'State')
      : place.level === 'district'
        ? (place.district || 'District')
        : (currentPhc ? shortPhcName(currentPhc.name) : (user?.scope_label || 'PHC'));
  const onNationalHome = audience === 'national' && place.level === 'national';
  const onOwnState = audience === 'state' && place.level === 'state';
  const onOwnDistrict = audience === 'district' && place.level === 'district';
  const onOwnPhc = audience === 'phc' && place.level === 'phc';
  const navItems = [{ id: 'overview', label: 'Dashboard' }];
  if (onNationalHome || onOwnState || onOwnDistrict || onOwnPhc) {
    navItems.push({ id: 'resources', label: 'Resources' });
  }
  if (onNationalHome || onOwnDistrict) {
    navItems.push({ id: 'demand', label: 'Patient Demand' });
  }
  if (onNationalHome || onOwnState || onOwnDistrict || onOwnPhc) {
    navItems.push({ id: 'forecast', label: 'Demand Forecast' });
  }
  if (onNationalHome) {
    navItems.push({ id: 'emergency', label: 'Emergency Simulation' });
  }
  if (onNationalHome || onOwnState || onOwnDistrict) {
    navItems.push({ id: 'redistribution', label: 'Redistribution' });
  }
  if (onNationalHome || onOwnState || onOwnDistrict || onOwnPhc) {
    navItems.push({ id: 'intelligence', label: 'AI Intelligence' });
  }
  if (audience === 'phc') {
    navItems.push({ id: 'manage', label: 'Manage Resources', href: '/phc/resources' });
  }

  return (
    <AppLayout
      states={states}
      selectedState={place.level === 'national' ? selectedState : (place.state || selectedState)}
      onStateChange={onHeaderState}
      asOf={asOf}
      onRefresh={refresh}
      refreshing={refreshing}
      showStateSelect={audience === 'national'}
      pageTitle={pageTitle}
      navItems={navItems}
      alertCount={visibleAlerts.filter((alert) => alert.severity === 'CRITICAL').length}
      session={user ? {
        name: user.name,
        roleLabel: ROLE_LABEL[user.role] || user.role,
        scopeLabel: user.scope_label,
      } : null}
      onLogout={logout}
    >
      {loading && !hasData ? (
        <div className="page-loading">
          <Skeleton active paragraph={{ rows: 4 }} />
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : null}

      {!loading && error && !hasData ? (
        <Result
          status="error"
          title={error}
          subTitle="Confirm the API is running, then try again."
          extra={<Button type="primary" onClick={refresh}>Try again</Button>}
        />
      ) : null}

      {hasData ? (
        <>
          <section id="overview" className="dash-section">
            {onNationalHome ? (
              <div className="hero">
                <div>
                  <p className="hero-kicker">Bharat Health Grid</p>
                  <h1>National Health Resource Intelligence</h1>
                  <p>Real-time visibility into PHC capacity, medicine availability, workforce and patient demand across India.</p>
                </div>
                <div className="system-pill"><span className="system-dot" /> System operational</div>
              </div>
            ) : (
              <section className="scope-banner">
                <div className="scope-kicker">{onOwnPhc ? 'Today\'s overview' : 'Signed-in scope'}</div>
                <h2>{scopeCopy.title}</h2>
                <p>{onOwnPhc
                  ? 'Medicine stock, beds, patient footfall, staff attendance, and alerts for this PHC.'
                  : scopeCopy.detail}
                </p>
              </section>
            )}
            <DrillBreadcrumb items={crumbs} onNavigate={onCrumb} />
          </section>
          {onNationalHome ? (
            <div className="dashboard">
              <KpiCards {...kpis} />
              <PhcMap
                phcs={phcs}
                beds={beds}
                stock={stock}
                alerts={alerts}
                onOpenPhc={openMappedPhc}
              />
              <StateOverview summary={visibleSummary} alerts={visibleAlerts} onStateSelect={openState} />
              <section id="alerts"><AlertPanel alerts={visibleAlerts} /></section>
              <section id="resources" className="dash-section">
                <MedicineRiskTable stock={visibleStock} />
                <BedUtilizationChart beds={visibleBeds} />
              </section>
              <section id="demand"><FootfallTrendChart phcs={visiblePhcs} refreshKey={dataVersion} /></section>
              <section id="forecast"><DemandForecastPanel selectedState={selectedState} refreshKey={dataVersion} /></section>
              <section id="emergency">
                <EmergencyResponsePanel
                  selectedState={selectedState}
                  refreshKey={dataVersion}
                  onOpenPhc={openMappedPhc}
                />
              </section>
              <section id="redistribution"><RedistributionPanel canApprove /></section>
              <section id="intelligence" className="dash-section">
                <AiRiskPanel />
                <AiQueryPanel />
              </section>
            </div>
          ) : null}
          {place.level === 'state' ? (
            <>
              <StateLevelView
                stateName={place.state}
                summary={summary}
                alerts={alerts}
                phcs={phcs}
                beds={beds}
                stock={stock}
                footfall={footfall}
                footfallReady={footfallReady}
                onDistrictSelect={openDistrict}
              />
              {audience === 'state' ? (
                <div className="dashboard">
                  <section id="alerts"><AlertPanel alerts={alerts.filter((row) => row.state === place.state)} /></section>
                  <section id="resources"><MedicineRiskTable stock={stock.filter((row) => row.state === place.state)} /></section>
                  <section id="forecast"><DemandForecastPanel selectedState={place.state} refreshKey={dataVersion} /></section>
                  <section id="redistribution"><RedistributionPanel canApprove /></section>
                  <section id="intelligence" className="dash-section">
                    <AiRiskPanel />
                    <AiQueryPanel />
                  </section>
                </div>
              ) : null}
            </>
          ) : null}
          {place.level === 'district' ? (
            <>
              <DistrictLevelView
                stateName={place.state}
                districtName={place.district}
                phcs={phcs}
                beds={beds}
                stock={stock}
                alerts={alerts}
                footfall={footfall}
                footfallReady={footfallReady}
                onPhcSelect={openPhc}
              />
              {audience === 'district' ? (
                <div className="dashboard">
                  <section id="alerts"><AlertPanel alerts={alerts.filter((row) => row.district === place.district)} /></section>
                  <section id="resources" className="dash-section">
                    <MedicineRiskTable stock={stock.filter((row) => row.district === place.district)} />
                    <BedUtilizationChart beds={beds.filter((row) => row.district === place.district)} />
                  </section>
                  <section id="demand"><FootfallTrendChart phcs={phcs.filter((row) => row.district === place.district)} refreshKey={dataVersion} /></section>
                  <section id="forecast"><DemandForecastPanel selectedState={place.state} refreshKey={dataVersion} /></section>
                  <section id="redistribution"><RedistributionPanel reviewOnly /></section>
                  <section id="intelligence" className="dash-section">
                    <AiRiskPanel />
                    <AiQueryPanel />
                  </section>
                </div>
              ) : null}
            </>
          ) : null}
          {place.level === 'phc' ? (
            <>
              {audience === 'phc' ? (
                <Card className="section-card">
                  <h3 style={{ marginTop: 0 }}>Manage Resources</h3>
                  <p className="card-subtitle">Update medicine stock, patient footfall, beds, and staff attendance for this PHC.</p>
                  <Button type="primary" onClick={() => navigate('/phc/resources')}>
                    Manage Resources
                  </Button>
                </Card>
              ) : null}
              <section id="resources"><PhcDetailView phcId={place.phcId} alerts={alerts} /></section>
              {audience === 'phc' ? (
                <div className="dashboard">
                  <section id="forecast"><DemandForecastPanel selectedState={place.state} refreshKey={dataVersion} /></section>
                  <section id="intelligence" className="dash-section">
                    <AiRiskPanel />
                    <AiQueryPanel />
                  </section>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </AppLayout>
  );
}

export default DashboardPage;
