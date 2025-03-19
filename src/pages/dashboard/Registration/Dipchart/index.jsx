import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Select, Space, Card,
    Typography, message, Tooltip, Popconfirm, InputNumber,
    Upload, Row, Col, Divider, Progress
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, UploadOutlined, DatabaseOutlined,
    LineChartOutlined, ClockCircleOutlined, LockOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, getDoc, setDoc } from 'firebase/firestore';
import { exportToExcel } from '../../../../services/exportService';
import { db } from '../../../../config/firebase';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
import { useAuth } from '../../../../context/AuthContext'; // Assuming you have an auth context

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale);

const { Title } = Typography;
const { Option } = Select;

// Helper to format date to YYYY-MM-DDThh:mm (for datetime-local input)
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
    const [dipCharts, setDipCharts] = useState([]);
    const [tanks, setTanks] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isBulkModalVisible, setIsBulkModalVisible] = useState(false);
    const [isDateModalVisible, setIsDateModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [bulkForm] = Form.useForm();
    const [dateForm] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [buttonLoading, setButtonLoading] = useState(false);
    const [dateButtonLoading, setDateButtonLoading] = useState(false);
    const [selectedTank, setSelectedTank] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());
    // const [isAdmin, setIsAdmin] = useState(false);

    const { user: currentUser, isAdmin } = useAuth(); // Assuming you have an auth context with currentUser

    useEffect(() => {
        fetchDipCharts();
        fetchTanks();
        // checkAdminStatus();
        fetchStoredDateTime();

        // Update date and time every minute
        const dateTimeInterval = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 60000);

        return () => clearInterval(dateTimeInterval);
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
            const dipChartList = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: docSnap.data().createdAt || new Date().toISOString(),
                updatedAt: docSnap.data().updatedAt || new Date().toISOString()
            }));
            setDipCharts(dipChartList);
        } catch (error) {
            message.error("Failed to fetch dip charts: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTanks = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "tanks"));
            const tankList = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));
            setTanks(tankList);
        } catch (error) {
            message.error("Failed to fetch tanks: " + error.message);
        }
    };

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            // Set the form fields including recordedAt in datetime-local format
            form.setFieldsValue({
                ...record,
                recordedAt: record.recordedAt
                    ? formatDateTimeLocal(record.recordedAt)
                    : formatDateTimeLocal(new Date())
            });
        } else {
            setEditingId(null);
            // For a new entry, prefill recordedAt with current date/time (as datetime-local string)
            form.resetFields();
            form.setFieldsValue({
                recordedAt: formatDateTimeLocal(new Date())
            });
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
            // Store in Firestore
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

    const handleSubmit = async (values) => {
        setButtonLoading(true);
        try {
            const timestamp = new Date().toISOString();
            // Process the recordedAt field:
            // For admin: use the provided value (converted to ISO)
            // For non-admin:
            //   - If new record: automatically set to current time
            //   - If updating: preserve the existing recordedAt field
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

            // Create array of entries from text input
            const entries = dipChartData.split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => {
                    const [inches, liters] = line.split(',').map(item => item.trim());
                    return {
                        tankId,
                        chartCode: `${tankId}-${inches}`,
                        dipInches: parseFloat(inches),
                        dipLiters: parseFloat(liters),
                        recordedAt: new Date().toISOString(), // Automatically set for bulk entries
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
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
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
                    <Tooltip title="Edit">
                        <Button
                            type="primary"
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
                        >
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                                loading={buttonLoading}
                                disabled={buttonLoading}
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const handleTankChange = (value) => {
        setSelectedTank(value);
    };

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
                </Space>
            </div>

            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                    <Select
                        placeholder="Filter by tank"
                        style={{ width: '100%' }}
                        onChange={handleTankChange}
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
                    dataSource={selectedTank ? dipCharts.filter(d => d.tankId === selectedTank) : dipCharts}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, responsive: true }}
                    bordered
                    scroll={{ x: 'max-content' }}
                />
            </div>

            {/* Add/Edit Modal */}
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
                        rules={[
                            { required: true, message: 'Please enter dip measurement' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    const tankId = getFieldValue('tankId');
                                    const existing = dipCharts.find(d => d.tankId === tankId && d.dipInches === value && d.id !== editingId);
                                    if (existing) return Promise.reject('This dip measurement already exists for the tank');
                                    return Promise.resolve();
                                },
                            }),
                        ]}
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
                        {/* 
                          For admin, the field is editable.
                          For non-admin, it is read-only.
                        */}
                        <Input
                            type="datetime-local"
                            readOnly={!isAdmin}
                        />
                    </Form.Item>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleCancel} disabled={buttonLoading}>Cancel</Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={buttonLoading}
                                disabled={buttonLoading}
                            >
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
                            placeholder="Example:
1,150
2,300
3,450"
                        />
                    </Form.Item>

                    <Divider />
                    <Typography.Paragraph type="secondary">
                        Note: Each line should contain a pair of values separated by a comma.
                        The first value is the dip measurement in inches, the second value is the corresponding volume in liters.
                    </Typography.Paragraph>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleBulkCancel} disabled={buttonLoading}>Cancel</Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={buttonLoading}
                                disabled={buttonLoading}
                            >
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

            {chartData && (
                <Modal
                    title="Dip Chart Visualization"
                    open={!!chartData}
                    onCancel={() => setChartData(null)}
                    footer={null}
                >
                    <Line data={chartData} />
                </Modal>
            )}
        </Card>
    );
};

export default DipChartManagement;
