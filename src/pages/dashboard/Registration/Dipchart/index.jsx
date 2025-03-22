import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Select, Space, Card,
    Typography, message, Tooltip, Popconfirm, InputNumber, Upload,
    Row, Col, Divider, Progress, Statistic, DatePicker
} from 'antd';
import moment from 'moment';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, UploadOutlined, DatabaseOutlined,
    LineChartOutlined, ClockCircleOutlined, LockOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { exportToExcel } from '../../../../services/exportService';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
import { useAuth } from '../../../../context/AuthContext';
import { db } from '../../../../config/firebase';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale);

const { Title } = Typography;
const { Option } = Select;

// Helper to format a Date for datetime-local inputs
const formatDateTimeLocal = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    const hours = ('0' + d.getHours()).slice(-2);
    const minutes = ('0' + d.getMinutes()).slice(-2);
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const DipChartManagement = () => {
    // Data states
    const [dipCharts, setDipCharts] = useState([]);
    const [tanks, setTanks] = useState([]);
    const [products, setProducts] = useState([]);

    // Modal visibility states
    const [isModalVisible, setIsModalVisible] = useState(false); // Add/Edit dip chart
    const [isBulkModalVisible, setIsBulkModalVisible] = useState(false);
    const [isDateModalVisible, setIsDateModalVisible] = useState(false);
    const [isGainLossModalVisible, setIsGainLossModalVisible] = useState(false);
    // NEW: Modal for recording a new dip reading for a tank
    const [isDipReadingModalVisible, setIsDipReadingModalVisible] = useState(false);
    // Modal for chart visualization
    const [isChartModalVisible, setIsChartModalVisible] = useState(false);
    // State for chart data
    const [chartData, setChartData] = useState(null);

    // For gain/loss calculation
    const [selectedTankForCalc, setSelectedTankForCalc] = useState(null);
    const [gainLossData, setGainLossData] = useState(null);

    // Form instances
    const [form] = Form.useForm();
    const [bulkForm] = Form.useForm();
    const [dateForm] = Form.useForm();
    // NEW: Dip Reading Form
    const [readingForm] = Form.useForm();

    // Other states
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [buttonLoading, setButtonLoading] = useState(false);
    const [dateButtonLoading, setDateButtonLoading] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());
    const [recordReadingLoading, setRecordReadingLoading] = useState(false);

    const { user: currentUser, isAdmin } = useAuth();

    useEffect(() => {
        fetchDipCharts();
        fetchTanks();
        fetchProducts();
        fetchStoredDateTime();
        const interval = setInterval(() => setCurrentDateTime(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchStoredDateTime = async () => {
        try {
            const dateTimeDoc = await getDoc(doc(db, "settings", "dipChartDateTime"));
            if (dateTimeDoc.exists() && dateTimeDoc.data().timestamp) {
                setCurrentDateTime(new Date(dateTimeDoc.data().timestamp));
            }
        } catch (error) {
            console.error("Error fetching stored date/time:", error);
        }
    };

    const fetchDipCharts = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "dipcharts"));
            const list = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: docSnap.data().createdAt || new Date().toISOString(),
                updatedAt: docSnap.data().updatedAt || new Date().toISOString()
            }));
            setDipCharts(list);
        } catch (error) {
            message.error("Failed to fetch dip charts: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTanks = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "tanks"));
            const list = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));
            setTanks(list);
        } catch (error) {
            message.error("Failed to fetch tanks: " + error.message);
        }
    };

    const fetchProducts = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "products"));
            const list = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));
            setProducts(list);
        } catch (error) {
            message.error("Failed to fetch products: " + error.message);
        }
    };

    // Show Add/Edit Dip Chart modal
    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue({
                ...record,
                recordedAt: record.recordedAt
                    ? formatDateTimeLocal(record.recordedAt)
                    : formatDateTimeLocal(new Date())
            });
        } else {
            setEditingId(null);
            form.resetFields();
            form.setFieldsValue({ recordedAt: formatDateTimeLocal(new Date()) });
        }
        setIsModalVisible(true);
    };

    const showBulkModal = () => {
        bulkForm.resetFields();
        setIsBulkModalVisible(true);
    };

    const showDateModal = () => {
        dateForm.setFieldsValue({
            date: formatDateTimeLocal(currentDateTime).split('T')[0],
            time: formatDateTimeLocal(currentDateTime).split('T')[1]
        });
        setIsDateModalVisible(true);
    };

    // Show Gain/Loss modal
    const showGainLossModal = () => {
        setIsGainLossModalVisible(true);
        setSelectedTankForCalc(null);
        setGainLossData(null);
    };

    // Show Dip Reading modal (for recording a new dip reading for a tank)
    const showDipReadingModal = () => {
        // Reset reading form and let user select a tank
        readingForm.resetFields();
        setSelectedTankForCalc(null);
        setIsDipReadingModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handleBulkCancel = () => {
        setIsBulkModalVisible(false);
        bulkForm.resetFields();
    };

    const handleDateCancel = () => {
        setIsDateModalVisible(false);
        dateForm.resetFields();
    };

    // Admin Date/Time update submit
    const handleDateSubmit = async (values) => {
        if (!isAdmin) {
            message.error("Only administrators can update the date and time");
            return;
        }
        setDateButtonLoading(true);
        try {
            const dateValue = new Date(values.date);
            const [hours, minutes] = values.time.split(':').map(Number);
            dateValue.setHours(hours, minutes);
            await setDoc(doc(db, "settings", "dipChartDateTime"), {
                timestamp: dateValue.toISOString(),
                updatedBy: currentUser?.uid || 'unknown',
                updatedAt: new Date().toISOString()
            });
            setCurrentDateTime(dateValue);
            message.success("Date and time updated successfully");
            setIsDateModalVisible(false);
        } catch (error) {
            message.error("Failed to update date and time: " + error.message);
        } finally {
            setDateButtonLoading(false);
        }
    };

    // Add/Edit Dip Chart submit
    const handleSubmit = async (values) => {
        setButtonLoading(true);
        try {
            const timestamp = new Date().toISOString();
            let newRecordedAt = values.recordedAt;
            if (isAdmin) {
                newRecordedAt = new Date(values.recordedAt).toISOString();
            } else {
                if (!editingId) {
                    newRecordedAt = new Date().toISOString();
                } else {
                    const existing = dipCharts.find(d => d.id === editingId);
                    newRecordedAt = existing?.recordedAt || new Date().toISOString();
                }
            }
            if (editingId) {
                await updateDoc(doc(db, "dipcharts", editingId), {
                    ...values,
                    recordedAt: newRecordedAt,
                    updatedAt: timestamp
                });
                message.success("Dip chart updated successfully");
            } else {
                await addDoc(collection(db, "dipcharts"), {
                    ...values,
                    recordedAt: newRecordedAt,
                    createdAt: timestamp,
                    updatedAt: timestamp
                });
                message.success("Dip chart created successfully");
            }
            setIsModalVisible(false);
            fetchDipCharts();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        } finally {
            setButtonLoading(false);
        }
    };

    const handleBulkSubmit = async (values) => {
        setButtonLoading(true);
        try {
            const { tankId, dipChartData } = values;
            const timestamp = new Date().toISOString();
            const entries = dipChartData.split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => {
                    const [inches, liters] = line.split(',').map(item => item.trim());
                    return {
                        tankId,
                        chartCode: `${tankId}-${inches}`,
                        dipInches: parseFloat(inches),
                        dipLiters: parseFloat(liters),
                        recordedAt: new Date().toISOString(),
                        createdAt: timestamp,
                        updatedAt: timestamp
                    };
                });
            let successCount = 0;
            for (const entry of entries) {
                await addDoc(collection(db, "dipcharts"), entry);
                successCount++;
            }
            message.success(`${successCount} dip chart entries added successfully`);
            setIsBulkModalVisible(false);
            fetchDipCharts();
        } catch (error) {
            message.error("Bulk import failed: " + error.message);
        } finally {
            setButtonLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setButtonLoading(true);
        try {
            await deleteDoc(doc(db, "dipcharts", id));
            message.success("Dip chart deleted successfully");
            fetchDipCharts();
        } catch (error) {
            message.error("Delete failed: " + error.message);
        } finally {
            setButtonLoading(false);
        }
    };

    const handleExportToExcel = () => {
        setButtonLoading(true);
        try {
            exportToExcel(dipCharts, 'DipCharts');
            message.success("Exported successfully");
        } catch (error) {
            message.error("Export failed: " + error.message);
        } finally {
            setButtonLoading(false);
        }
    };

    // Prepare chart data for visualization and open chart modal
    const prepareChartData = (tankId) => {
        const tankDipCharts = dipCharts
            .filter(d => d.tankId === tankId)
            .sort((a, b) => a.dipInches - b.dipInches);
        setChartData({
            labels: tankDipCharts.map(d => d.dipInches),
            datasets: [{
                label: 'Volume (Liters)',
                data: tankDipCharts.map(d => d.dipLiters),
                borderColor: '#1890ff',
                tension: 0.1,
            }],
        });
        setIsChartModalVisible(true);
    };

    // NEW: Handle submission of a new dip reading for a tank
    const handleDipReadingSubmit = async (values) => {
        setRecordReadingLoading(true);
        try {
            const { tankId, currentReading, newPrice } = values;
            // Get the tank document to obtain original capacity
            const tank = tanks.find(t => t.id === tankId);
            if (!tank) {
                message.error("Tank not found");
                setRecordReadingLoading(false);
                return;
            }
            const originalVolume = tank.capacity; // original volume of tank
            // Find latest dip chart entry for this tank to get previous reading
            const tankDipCharts = dipCharts
                .filter(d => d.tankId === tankId)
                .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
            const previousReading = tankDipCharts.length ? tankDipCharts[0].dipLiters : originalVolume;
            // Calculate sold volume: assuming dip reading decreases as fuel is sold
            const soldVolume = previousReading - currentReading;
            if (soldVolume < 0) {
                message.error("Current reading cannot be greater than previous reading");
                setRecordReadingLoading(false);
                return;
            }
            // Calculate price impact using the linked product (if any)
            let priceDifference = 0;
            if (tank.productId) {
                const product = products.find(p => p.id === tank.productId);
                if (product && product.salesPrice) {
                    priceDifference = soldVolume * product.salesPrice;
                }
            }
            // Update tank's current volume (assume we store currentVolume)
            const tankRef = doc(db, "tanks", tankId);
            await updateDoc(tankRef, { currentVolume: currentReading });
            // Add a new dip chart entry for this reading
            await addDoc(collection(db, "dipcharts"), {
                tankId,
                chartCode: `${tankId}-${moment().format('YYYYMMDDHHmmss')}`,
                dipInches: null, // Not provided here
                dipLiters: currentReading,
                recordedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            // If a new price is provided, update the product's sales price
            if (newPrice !== undefined && newPrice !== null) {
                await updateDoc(doc(db, "products", tank.productId), { salesPrice: newPrice });
            }
            message.success("Dip reading recorded successfully");
            setIsDipReadingModalVisible(false);
            fetchDipCharts();
            fetchTanks();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        } finally {
            setRecordReadingLoading(false);
        }
    };

    // NEW: Handle Gain/Loss modal submission
    const handleGainLossModalSubmit = (values) => {
        const { tankId } = values;
        setSelectedTankForCalc(tankId);
        // Calculate gain/loss based on tank original capacity and latest dip reading
        const tank = tanks.find(t => t.id === tankId);
        if (!tank) {
            message.error("Tank not found");
            return;
        }
        const originalVolume = tank.capacity;
        const tankDipCharts = dipCharts
            .filter(d => d.tankId === tankId)
            .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
        if (!tankDipCharts.length) {
            message.error("No dip chart entries found for this tank");
            return;
        }
        const latestDip = tankDipCharts[0];
        const remainingVolume = latestDip.dipLiters;
        const soldVolume = originalVolume - remainingVolume;
        let priceDifference = 0;
        if (tank.productId) {
            const product = products.find(p => p.id === tank.productId);
            if (product && product.salesPrice) {
                priceDifference = soldVolume * product.salesPrice;
            }
        }
        setGainLossData({
            originalVolume,
            remainingVolume,
            soldVolume,
            priceDifference
        });
    };

    const columns = [
        {
            title: 'Chart Code',
            dataIndex: 'chartCode',
            key: 'chartCode',
            sorter: (a, b) => a.chartCode.localeCompare(b.chartCode),
        },
        {
            title: 'Tank',
            dataIndex: 'tankId',
            key: 'tankId',
            render: (tankId) => {
                const tank = tanks.find(t => t.id === tankId);
                return tank ? tank.tankName : 'Unknown';
            },
            filters: tanks.map(t => ({ text: t.tankName, value: t.id })),
            onFilter: (value, record) => record.tankId === value,
        },
        {
            title: 'Dip (inches)',
            dataIndex: 'dipInches',
            key: 'dipInches',
            sorter: (a, b) => a.dipInches - b.dipInches,
        },
        {
            title: 'Volume (liters)',
            dataIndex: 'dipLiters',
            key: 'dipLiters',
            sorter: (a, b) => a.dipLiters - b.dipLiters,
        },
        {
            title: 'Created Date',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => date ? new Date(date).toLocaleDateString() : '-',
            sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
            responsive: ['md'],
        },
        {
            title: 'Updated Date',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            render: (date) => date ? new Date(date).toLocaleDateString() : '-',
            sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
            responsive: ['lg'],
        },
        {
            title: 'Recorded Date/Time',
            dataIndex: 'recordedAt',
            key: 'recordedAt',
            render: (date) =>
                date
                    ? new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString()
                    : '-',
            sorter: (a, b) => new Date(a.recordedAt) - new Date(b.recordedAt),
            responsive: ['lg'],
        },
        {
            title: 'View Chart',
            key: 'viewChart',
            render: (_, record) => (
                <Button
                    type="link"
                    icon={<LineChartOutlined />}
                    onClick={() => prepareChartData(record.tankId)}
                >
                    View
                </Button>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Record Dip Reading">
                        <Button
                            type="link"
                            onClick={showDipReadingModal}
                            size="small"
                        >
                            Record Dip
                        </Button>
                    </Tooltip>
                    <Tooltip title="Daily Gain/Loss">
                        <Button
                            type="link"
                            onClick={showGainLossModal}
                            size="small"
                        >
                            Daily Gain/Loss
                        </Button>
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            type="default"
                            icon={<EditOutlined />}
                            onClick={() => showModal(record)}
                            size="small"
                            loading={buttonLoading}
                            disabled={buttonLoading}
                        />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Popconfirm
                            title="Are you sure you want to delete this dip chart entry?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                            okButtonProps={{ loading: buttonLoading }}
                        >
                            <Button
                                danger
                                icon={buttonLoading ? <LoadingOutlined /> : <DeleteOutlined />}
                                size="small"
                                disabled={buttonLoading}
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <Card className="dipchart-management-container">
            <div className="dipchart-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div>
                    <Title level={3}>Dip Chart Management</Title>
                </div>
                <Space wrap style={{ marginTop: '10px' }}>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => showModal()}
                        loading={buttonLoading}
                        disabled={buttonLoading}
                    >
                        Add Entry
                    </Button>
                    <Button
                        type="default"
                        icon={<UploadOutlined />}
                        onClick={showBulkModal}
                        loading={buttonLoading}
                        disabled={buttonLoading}
                    >
                        Bulk Import
                    </Button>
                    <Button
                        type="default"
                        icon={<FileExcelOutlined />}
                        onClick={handleExportToExcel}
                        loading={buttonLoading}
                        disabled={buttonLoading}
                    >
                        Export to Excel
                    </Button>
                    <Button
                        type="default"
                        onClick={showGainLossModal}
                        loading={buttonLoading}
                        disabled={buttonLoading}
                    >
                        Daily Gain/Loss
                    </Button>
                    <Button
                        type="default"
                        onClick={showDipReadingModal}
                        loading={buttonLoading}
                        disabled={buttonLoading}
                    >
                        Record Dip Reading
                    </Button>
                </Space>
            </div>

            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                    <Select
                        placeholder="Filter by tank"
                        style={{ width: '100%' }}
                        onChange={(value) => setSelectedTankForCalc(value)}
                        allowClear
                        disabled={buttonLoading}
                    >
                        {tanks.map(tank => (
                            <Option key={tank.id} value={tank.id}>{tank.tankName}</Option>
                        ))}
                    </Select>
                </Col>
            </Row>

            <div className="table-responsive">
                <Table
                    columns={columns}
                    dataSource={selectedTankForCalc ? dipCharts.filter(d => d.tankId === selectedTankForCalc) : dipCharts}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, responsive: true }}
                    bordered
                    scroll={{ x: 'max-content' }}
                />
            </div>

            {/* Add/Edit Dip Chart Modal */}
            <Modal
                title={editingId ? "Edit Dip Chart Entry" : "Add New Dip Chart Entry"}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="chartCode"
                        label="Chart Code"
                        rules={[{ required: true, message: 'Please enter chart code' }]}
                    >
                        <Input prefix={<LineChartOutlined />} placeholder="Enter chart code" />
                    </Form.Item>

                    <Form.Item
                        name="tankId"
                        label="Tank"
                        rules={[{ required: true, message: 'Please select tank' }]}
                    >
                        <Select placeholder="Select tank">
                            {tanks.map(tank => (
                                <Option key={tank.id} value={tank.id}>{tank.tankName}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="dipInches"
                        label="Dip (inches)"
                        rules={[{ required: true, message: 'Please enter dip measurement' }]}
                    >
                        <InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="Enter dip in inches" />
                    </Form.Item>

                    <Form.Item
                        name="dipLiters"
                        label="Volume (liters)"
                        rules={[{ required: true, message: 'Please enter volume' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter volume in liters" />
                    </Form.Item>

                    <Form.Item
                        name="recordedAt"
                        label="Recorded Date/Time"
                        rules={[{ required: true, message: 'Recorded date/time is required' }]}
                    >
                        <Input type="datetime-local" readOnly={!isAdmin} />
                    </Form.Item>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleCancel} disabled={buttonLoading}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={buttonLoading} disabled={buttonLoading}>
                                {editingId ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Bulk Import Modal */}
            <Modal
                title="Bulk Import Dip Chart"
                open={isBulkModalVisible}
                onCancel={handleBulkCancel}
                footer={null}
                width={800}
            >
                <Form
                    form={bulkForm}
                    layout="vertical"
                    onFinish={handleBulkSubmit}
                >
                    <Form.Item
                        name="tankId"
                        label="Tank"
                        rules={[{ required: true, message: 'Please select tank' }]}
                    >
                        <Select placeholder="Select tank">
                            {tanks.map(tank => (
                                <Option key={tank.id} value={tank.id}>{tank.tankName}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="dipChartData"
                        label="Dip Chart Data (Format: inches,liters - one entry per line)"
                        rules={[{ required: true, message: 'Please enter dip chart data' }]}
                    >
                        <Input.TextArea
                            rows={10}
                            placeholder={`Example:
1,150
2,300
3,450`}
                        />
                    </Form.Item>

                    <Divider />
                    <Typography.Paragraph type="secondary">
                        Note: Each line should contain a pair of values separated by a comma. The first value is the dip measurement in inches, the second value is the corresponding volume in liters.
                    </Typography.Paragraph>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleBulkCancel} disabled={buttonLoading}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={buttonLoading} disabled={buttonLoading}>
                                Import Data
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Date/Time Modal for Admin */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <LockOutlined style={{ marginRight: '8px' }} />
                        Admin Date/Time Update
                    </div>
                }
                open={isDateModalVisible}
                onCancel={handleDateCancel}
                footer={null}
                width={400}
            >
                <Form
                    form={dateForm}
                    layout="vertical"
                    onFinish={handleDateSubmit}
                >
                    <Form.Item
                        name="date"
                        label="Date"
                        rules={[{ required: true, message: 'Please select a date' }]}
                    >
                        <Input type="date" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="time"
                        label="Time"
                        rules={[{ required: true, message: 'Please select a time' }]}
                    >
                        <Input type="time" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleDateCancel} disabled={dateButtonLoading}>Cancel</Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={dateButtonLoading}
                                disabled={dateButtonLoading || !isAdmin}
                                icon={<ClockCircleOutlined />}
                            >
                                Update Date/Time
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Daily Gain/Loss Modal */}
            <Modal
                title="Daily Gain/Loss Calculation"
                open={isGainLossModalVisible}
                onCancel={() => setIsGainLossModalVisible(false)}
                footer={null}
                width={500}
            >
                <Form layout="vertical" onFinish={handleGainLossModalSubmit}>
                    <Form.Item
                        name="tankId"
                        label="Select Tank"
                        rules={[{ required: true, message: 'Please select a tank' }]}
                    >
                        <Select placeholder="Select tank">
                            {tanks.map(tank => (
                                <Option key={tank.id} value={tank.id}>{tank.tankName}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={() => setIsGainLossModalVisible(false)}>Cancel</Button>
                            <Button type="primary" htmlType="submit">
                                Calculate
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
                {gainLossData && (
                    <div style={{ marginTop: '20px' }}>
                        <Title level={5}>Daily Gain/Loss</Title>
                        <p>Original Volume: {gainLossData.originalVolume} liters</p>
                        <p>Remaining Volume: {gainLossData.remainingVolume} liters</p>
                        <p>Sold Volume: {gainLossData.soldVolume} liters</p>
                        <p>Price Impact: ₨{gainLossData.priceDifference.toFixed(2)}</p>
                    </div>
                )}
            </Modal>

            {/* Dip Chart Visualization Modal */}
            <Modal
                title="Dip Chart Visualization"
                open={isChartModalVisible}
                onCancel={() => setIsChartModalVisible(false)}
                footer={null}
            >
                {chartData && <Line data={chartData} />}
            </Modal>

            {/* Record Dip Reading Modal */}
            <Modal
                title="Record Dip Reading"
                open={isDipReadingModalVisible}
                onCancel={() => { setIsDipReadingModalVisible(false); readingForm.resetFields(); }}
                footer={null}
            >
                <Form
                    form={readingForm}
                    layout="vertical"
                    onFinish={handleDipReadingSubmit}
                >
                    <Form.Item
                        name="tankId"
                        label="Select Tank"
                        rules={[{ required: true, message: 'Please select a tank' }]}
                    >
                        <Select placeholder="Select tank">
                            {tanks.map(tank => (
                                <Option key={tank.id} value={tank.id}>{tank.tankName}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    {/* previousReading will be auto-filled on submission */}
                    <Form.Item
                        name="currentReading"
                        label="Current Reading (liters)"
                        rules={[{ required: true, message: 'Please enter current reading' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter current reading" />
                    </Form.Item>
                    <Form.Item
                        name="newPrice"
                        label="New Product Price (PKR)"
                    >
                        <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            placeholder="Enter new product price if updating"
                            formatter={value => `₨ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value.replace(/₨\s?|(,*)/g, '')}
                        />
                    </Form.Item>
                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={() => { setIsDipReadingModalVisible(false); readingForm.resetFields(); }}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={recordReadingLoading}>
                                Record Reading
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default DipChartManagement;
