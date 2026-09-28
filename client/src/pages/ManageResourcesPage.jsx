import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
} from 'antd';
import AppLayout from '../layouts/AppLayout.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABEL } from '../auth/roles.js';
import {
  createManagedAttendance,
  createManagedBeds,
  createManagedFootfall,
  createManagedMedicine,
  deleteManagedAttendance,
  deleteManagedBeds,
  deleteManagedFootfall,
  deleteManagedMedicine,
  getPhcs,
  listManagedAttendance,
  listManagedBeds,
  listManagedFootfall,
  listManagedMedicine,
  updateManagedAttendance,
  updateManagedBeds,
  updateManagedFootfall,
  updateManagedMedicine,
} from '../services/api.js';
import { formatDate, formatDecimal, formatNumber } from '../utils/format.js';
import { STOCK_COLOR } from '../utils/labels.js';
import './ManageResourcesPage.css';

function dateText(value) {
  if (!value) {
    return '';
  }
  if (typeof value.format === 'function') {
    return value.format('YYYY-MM-DD');
  }
  return String(value).slice(0, 10);
}

function DeleteAction({ title, onConfirm }) {
  return (
    <Popconfirm
      title={title}
      description="This action cannot be undone."
      okText="Delete"
      cancelText="Cancel"
      onConfirm={onConfirm}
    >
      <Button danger size="small">Delete</Button>
    </Popconfirm>
  );
}

function MedicineTab({ reloadKey }) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [records, setRecords] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listManagedMedicine();
      setRecords(data.records || []);
      setMedicines(data.medicines || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [reloadKey]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }

  function openEdit(record) {
    setEditing(record);
    form.setFieldsValue({
      medicineId: record.medicine_id,
      batchNumber: record.batch_number,
      expiryDate: dayjs(record.expiry_date),
      quantity: record.current_quantity,
      dailyUsage: record.daily_average_usage,
    });
    setOpen(true);
  }

  async function onSubmit(values) {
    setSaving(true);
    try {
      const payload = editing
        ? {
          expiryDate: dateText(values.expiryDate),
          quantity: values.quantity,
          dailyUsage: values.dailyUsage,
        }
        : {
          medicineId: values.medicineId,
          batchNumber: values.batchNumber,
          expiryDate: dateText(values.expiryDate),
          quantity: values.quantity,
          dailyUsage: values.dailyUsage,
        };
      const data = editing
        ? await updateManagedMedicine(editing.id, payload)
        : await createManagedMedicine(payload);
      setRecords(data.records || []);
      setOpen(false);
      message.success(editing ? 'Record updated.' : 'Record saved.');
    } catch (requestError) {
      message.error(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(record) {
    try {
      const data = await deleteManagedMedicine(record.id);
      setRecords(data.records || []);
      message.success('Record deleted successfully.');
    } catch (requestError) {
      message.error(requestError.message);
    }
  }

  const columns = [
    { title: 'Medicine', dataIndex: 'medicine', key: 'medicine' },
    { title: 'Batch', dataIndex: 'batch_number', key: 'batch_number' },
    {
      title: 'Expiry Date',
      dataIndex: 'expiry_date',
      key: 'expiry_date',
      render: (value) => formatDate(value),
    },
    {
      title: 'Current Quantity',
      dataIndex: 'current_quantity',
      key: 'current_quantity',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Daily Usage',
      dataIndex: 'daily_average_usage',
      key: 'daily_average_usage',
      align: 'right',
      render: (value) => formatDecimal(value),
    },
    {
      title: 'Status',
      dataIndex: 'stock_status',
      key: 'stock_status',
      render: (value) => <Tag color={STOCK_COLOR[value] || 'default'}>{value}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="row-actions">
          <Button size="small" onClick={() => openEdit(record)}>Edit</Button>
          <DeleteAction title="Delete this medicine stock record?" onConfirm={() => onDelete(record)} />
        </div>
      ),
    },
  ];

  return (
    <Card
      className="section-card"
      extra={<Button type="primary" onClick={openCreate}>+ Add Medicine Stock</Button>}
    >
      {error ? <Alert type="error" showIcon title={error} /> : null}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={records}
        loading={loading}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 860 }}
        locale={{ emptyText: 'No medicine stock records found.' }}
      />
      <Modal
        open={open}
        title={editing ? 'Edit medicine stock' : 'Add medicine stock'}
        okText={editing ? 'Save' : 'Add'}
        confirmLoading={saving}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
          <Form.Item label="Medicine" name="medicineId" rules={[{ required: !editing, message: 'Select a medicine' }]}>
            <Select
              disabled={Boolean(editing)}
              showSearch
              optionFilterProp="label"
              options={medicines.map((item) => ({ value: item.id, label: item.name }))}
              placeholder="Select a medicine"
            />
          </Form.Item>
          <Form.Item label="Batch Number" name="batchNumber" rules={[{ required: !editing, message: 'Enter a batch number' }]}>
            <Input disabled={Boolean(editing)} maxLength={40} />
          </Form.Item>
          <Form.Item label="Expiry Date" name="expiryDate" rules={[{ required: true, message: 'Enter an expiry date' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Current Quantity" name="quantity" rules={[{ required: true, message: 'Enter the current quantity' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Daily Usage" name="dailyUsage" rules={[{ required: true, message: 'Enter the daily usage' }]}>
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function FootfallTab({ reloadKey }) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listManagedFootfall();
      setRecords(data.records || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [reloadKey]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }

  function openEdit(record) {
    setEditing(record);
    form.setFieldsValue({
      recordDate: dayjs(record.record_date),
      visits: record.total_patients,
    });
    setOpen(true);
  }

  async function onSubmit(values) {
    setSaving(true);
    try {
      const payload = { recordDate: dateText(values.recordDate), visits: values.visits };
      const data = editing
        ? await updateManagedFootfall(editing.id, payload)
        : await createManagedFootfall(payload);
      setRecords(data.records || []);
      setOpen(false);
      message.success(editing ? 'Record updated.' : 'Record saved.');
    } catch (requestError) {
      message.error(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(record) {
    try {
      const data = await deleteManagedFootfall(record.id);
      setRecords(data.records || []);
      message.success('Record deleted successfully.');
    } catch (requestError) {
      message.error(requestError.message);
    }
  }

  const columns = [
    { title: 'Date', dataIndex: 'record_date', key: 'record_date', render: (value) => formatDate(value) },
    {
      title: 'Patient Visits',
      dataIndex: 'total_patients',
      key: 'total_patients',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Recorded',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value) => formatDate(String(value || '').slice(0, 10)),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="row-actions">
          <Button size="small" onClick={() => openEdit(record)}>Edit</Button>
          <DeleteAction title="Are you sure you want to delete this record?" onConfirm={() => onDelete(record)} />
        </div>
      ),
    },
  ];

  return (
    <Card className="section-card" extra={<Button type="primary" onClick={openCreate}>+ Add Footfall</Button>}>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={records}
        loading={loading}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 640 }}
        locale={{ emptyText: 'No patient footfall records found.' }}
      />
      <Modal
        open={open}
        title={editing ? 'Edit footfall' : 'Add footfall'}
        okText={editing ? 'Save' : 'Add'}
        confirmLoading={saving}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
          <Form.Item label="Date" name="recordDate" rules={[{ required: true, message: 'Enter the visit date' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Patient Visits" name="visits" rules={[{ required: true, message: 'Enter the number of visits' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function BedsTab({ reloadKey }) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [configuration, setConfiguration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listManagedBeds();
      setConfiguration(data.configuration || null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [reloadKey]);

  function openCreate() {
    setEditing(false);
    form.resetFields();
    setOpen(true);
  }

  function openEdit() {
    setEditing(true);
    form.setFieldsValue({
      totalBeds: configuration.total_beds,
      occupiedBeds: configuration.occupied_beds,
    });
    setOpen(true);
  }

  async function onSubmit(values) {
    setSaving(true);
    try {
      const payload = { totalBeds: values.totalBeds, occupiedBeds: values.occupiedBeds };
      const data = editing
        ? await updateManagedBeds(configuration.id, payload)
        : await createManagedBeds(payload);
      setConfiguration(data.configuration || null);
      setRemoved(false);
      setOpen(false);
      message.success(editing ? 'Record updated.' : 'Record saved.');
    } catch (requestError) {
      message.error(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    try {
      const data = await deleteManagedBeds(configuration.id);
      setConfiguration(data.configuration || null);
      setRemoved(true);
      message.success('Record deleted successfully.');
    } catch (requestError) {
      message.error(requestError.message);
    }
  }

  return (
    <Card
      className="section-card"
      extra={loading ? null : configuration ? (
        <div className="row-actions">
          <Button onClick={openEdit}>Edit</Button>
          <DeleteAction title="Are you sure you want to delete this record?" onConfirm={onDelete} />
        </div>
      ) : (
        <Button type="primary" onClick={openCreate}>+ Add Bed Configuration</Button>
      )}
    >
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {removed && !configuration ? (
        <Alert
          type="warning"
          showIcon
          title="This PHC has no bed configuration"
          description="Occupancy and bed alerts cannot be calculated until a configuration is added."
        />
      ) : null}
      {loading ? <Spin /> : null}
      {!loading && !configuration ? (
        <p className="empty-note">No bed configuration found.</p>
      ) : null}
      {configuration ? (
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}><Statistic title="Total Beds" value={configuration.total_beds} /></Col>
          <Col xs={12} md={6}><Statistic title="Occupied Beds" value={configuration.occupied_beds} /></Col>
          <Col xs={12} md={6}><Statistic title="Available Beds" value={configuration.available_beds} /></Col>
          <Col xs={12} md={6}><Statistic title="Occupancy %" value={configuration.occupancy_percentage} suffix="%" /></Col>
        </Row>
      ) : null}
      <Modal
        open={open}
        title={editing ? 'Edit bed configuration' : 'Add bed configuration'}
        okText={editing ? 'Save' : 'Add'}
        confirmLoading={saving}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
          <Form.Item label="Total Beds" name="totalBeds" rules={[{ required: true, message: 'Enter the total beds' }]}>
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Occupied Beds" name="occupiedBeds" rules={[{ required: true, message: 'Enter the occupied beds' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function AttendanceTab({ reloadKey }) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [records, setRecords] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [statuses, setStatuses] = useState(['Present', 'Absent', 'Leave']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listManagedAttendance();
      setRecords(data.records || []);
      setPersonnel(data.personnel || []);
      if (data.statuses?.length) {
        setStatuses(data.statuses);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [reloadKey]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }

  function openEdit(record) {
    setEditing(record);
    form.setFieldsValue({
      personnelId: record.personnel_id,
      attendanceDate: dayjs(record.attendance_date),
      status: record.status,
    });
    setOpen(true);
  }

  async function onSubmit(values) {
    setSaving(true);
    try {
      const data = editing
        ? await updateManagedAttendance(editing.id, {
          attendanceDate: dateText(values.attendanceDate),
          status: values.status,
        })
        : await createManagedAttendance({
          personnelId: values.personnelId,
          attendanceDate: dateText(values.attendanceDate),
          status: values.status,
        });
      setRecords(data.records || []);
      setOpen(false);
      message.success(editing ? 'Record updated.' : 'Record saved.');
    } catch (requestError) {
      message.error(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(record) {
    try {
      const data = await deleteManagedAttendance(record.id);
      setRecords(data.records || []);
      message.success('Record deleted successfully.');
    } catch (requestError) {
      message.error(requestError.message);
    }
  }

  const columns = [
    { title: 'Personnel', dataIndex: 'personnel', key: 'personnel' },
    { title: 'Role', dataIndex: 'role', key: 'role' },
    {
      title: 'Date',
      dataIndex: 'attendance_date',
      key: 'attendance_date',
      render: (value) => formatDate(value),
    },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="row-actions">
          <Button size="small" onClick={() => openEdit(record)}>Edit</Button>
          <DeleteAction title="Are you sure you want to delete this record?" onConfirm={() => onDelete(record)} />
        </div>
      ),
    },
  ];

  return (
    <Card className="section-card" extra={<Button type="primary" onClick={openCreate}>+ Add Attendance</Button>}>
      <Alert
        type="info"
        showIcon
        title="Personnel records are read only"
        description="Attendance can be added only for people already assigned to this PHC."
      />
      {error ? <Alert type="error" showIcon title={error} /> : null}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={records}
        loading={loading}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 720 }}
        locale={{ emptyText: 'No attendance records found.' }}
      />
      <Modal
        open={open}
        title={editing ? 'Edit attendance' : 'Add attendance'}
        okText={editing ? 'Save' : 'Add'}
        confirmLoading={saving}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
          <Form.Item label="Personnel" name="personnelId" rules={[{ required: !editing, message: 'Select a staff member' }]}>
            <Select
              disabled={Boolean(editing)}
              showSearch
              optionFilterProp="label"
              placeholder="Select personnel"
              options={personnel.map((person) => ({
                value: person.id,
                label: `${person.name} (${person.role})`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Date" name="attendanceDate" rules={[{ required: true, message: 'Enter the attendance date' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Select a status' }]}>
            <Select options={statuses.map((status) => ({ value: status, label: status }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function ManageResourcesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [phc, setPhc] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    getPhcs()
      .then((rows) => {
        if (!ignore) {
          setPhc(Array.isArray(rows) ? rows[0] : null);
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          setError(requestError.message);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <AppLayout
      states={[]}
      selectedState="all"
      onStateChange={() => {}}
      showStateSelect={false}
      asOf={null}
      onRefresh={() => setReloadKey((current) => current + 1)}
      refreshing={false}
      pageTitle="Manage PHC Resources"
      pageKicker="PHC staff operations"
      navItems={[
        { id: 'dashboard', label: 'Dashboard', href: '/phc' },
        { id: 'resources', label: 'Resources', href: '/phc#resources' },
        { id: 'forecast', label: 'Demand Forecast', href: '/phc#forecast' },
        { id: 'intelligence', label: 'AI Intelligence', href: '/phc#intelligence' },
        { id: 'manage', label: 'Manage Resources', href: '/phc/resources' },
      ]}
      session={user ? {
        name: user.name,
        roleLabel: ROLE_LABEL[user.role] || user.role,
        scopeLabel: user.scope_label,
      } : null}
      onLogout={logout}
    >
      <section className="scope-banner">
        <div className="scope-kicker">PHC staff</div>
        <h2>Manage PHC Resources</h2>
        <p>Records are saved only for the signed-in PHC. Stock status, occupancy, alerts, and forecasts are recalculated from these records.</p>
      </section>
      <div className="manage-toolbar">
        <Button onClick={() => navigate('/phc')}>Back to PHC dashboard</Button>
      </div>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      <Card className="section-card phc-identity">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}><div className="identity-label">PHC Name</div><div>{phc?.name || '—'}</div></Col>
          <Col xs={24} md={12}><div className="identity-label">PHC Code</div><div>{phc?.phc_code || '—'}</div></Col>
          <Col xs={24} md={12}><div className="identity-label">District</div><div>{phc?.district || '—'}</div></Col>
          <Col xs={24} md={12}><div className="identity-label">State</div><div>{phc?.state || '—'}</div></Col>
        </Row>
      </Card>
      <Tabs
        items={[
          { key: 'medicine', label: 'Medicine Stock', children: <MedicineTab reloadKey={reloadKey} /> },
          { key: 'footfall', label: 'Patient Footfall', children: <FootfallTab reloadKey={reloadKey} /> },
          { key: 'beds', label: 'Beds', children: <BedsTab reloadKey={reloadKey} /> },
          { key: 'attendance', label: 'Staff Attendance', children: <AttendanceTab reloadKey={reloadKey} /> },
        ]}
      />
    </AppLayout>
  );
}

export default ManageResourcesPage;
