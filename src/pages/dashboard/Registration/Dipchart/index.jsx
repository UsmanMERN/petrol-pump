import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Select, Space, Card,
    Typography, message, Tooltip, Popconfirm, InputNumber, Row, Col
} from 'antd';
import moment from 'moment';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, LoadingOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { exportToExcel } from '../../../../services/exportService';
import { useAuth } from '../../../../context/AuthContext';
import { db } from '../../../../config/firebase';

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

    // Modal visibility state
    const [isModalVisible, setIsModalVisible] = useState(false);

    // For filtering the table by tank
    const [selectedTankForCalc, setSelectedTankForCalc] = useState(null);

    // Form instance
    const [form] = Form.useForm();

    // Other states
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [buttonLoading, setButtonLoading] = useState(false);

    const { user: currentUser, isAdmin } = useAuth();

    useEffect(() => {
        fetchDipCharts();
        fetchTanks();
        fetchProducts();
    }, []);

    const fetchDipCharts = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "dipcharts"));
            const list = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
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

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue({
                tankId: record.tankId,
                dipInches: record.dipInches,
                dipLiters: record.dipLiters,
                recordedAt: record.recordedAt ? formatDateTimeLocal(record.recordedAt) : formatDateTimeLocal(new Date())
            });
        } else {
            setEditingId(null);
            form.resetFields();
            form.setFieldsValue({ recordedAt: formatDateTimeLocal(new Date()) });
        }
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

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

    const columns = [
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
            title: 'Tank Opening Stock (liters)',
            key: 'tankOpeningStock',
            render: (_, record) => {
                const tank = tanks.find(t => t.id === record.tankId);
                return tank ? Number(tank.openingStock).toFixed(2) : '-';
            },
            sorter: (a, b) => {
                const tankA = tanks.find(t => t.id === a.tankId);
                const tankB = tanks.find(t => t.id === b.tankId);
                const osA = tankA ? Number(tankA.openingStock) : 0;
                const osB = tankB ? Number(tankB.openingStock) : 0;
                return osA - osB;
            },
        },
        {
            title: 'Tank Remaining Stock (liters)',
            key: 'tankRemainingStock',
            render: (_, record) => {
                const tank = tanks.find(t => t.id === record.tankId);
                return tank ? Number(tank.remainingStock).toFixed(2) : '-';
            },
            sorter: (a, b) => {
                const tankA = tanks.find(t => t.id === a.tankId);
                const tankB = tanks.find(t => t.id === b.tankId);
                const rsA = tankA ? Number(tankA.remainingStock) : 0;
                const rsB = tankB ? Number(tankB.remainingStock) : 0;
                return rsA - rsB;
            },
        },
        {
            title: 'Stock Difference (liters)',
            key: 'stockDiff',
            render: (_, record) => {
                const tank = tanks.find(t => t.id === record.tankId);
                if (!tank) return '-';
                // Difference remains as openingStock - remainingStock (static vs updated)
                const diff = Number(tank.openingStock) - Number(tank.remainingStock);
                const color = diff > 0 ? 'red' : diff < 0 ? 'green' : 'inherit';
                return <span style={{ color }}>{diff.toFixed(2)}</span>;
            },
            sorter: (a, b) => {
                const tankA = tanks.find(t => t.id === a.tankId);
                const tankB = tanks.find(t => t.id === b.tankId);
                const diffA = tankA ? Number(tankA.openingStock) - Number(tankA.remainingStock) : 0;
                const diffB = tankB ? Number(tankB.openingStock) - Number(tankB.remainingStock) : 0;
                return diffA - diffB;
            },
        },
        {
            title: 'Dip (inches)',
            dataIndex: 'dipInches',
            key: 'dipInches',
            sorter: (a, b) => (a.dipInches || 0) - (b.dipInches || 0),
        },
        {
            title: 'Volume (liters)',
            dataIndex: 'dipLiters',
            key: 'dipLiters',
            sorter: (a, b) => a.dipLiters - b.dipLiters,
        },
        {
            title: 'Gain/Loss (liters)',
            key: 'gainLoss',
            render: (_, record) => {
                const tank = tanks.find(t => t.id === record.tankId);
                if (!tank) return '-';
                // Compare the dip chart volume to the tank's current remainingStock.
                const diff = record.dipLiters - Number(tank.remainingStock);
                const color = diff > 0 ? 'green' : diff < 0 ? 'red' : 'inherit';
                return <span style={{ color }}>{diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}</span>;
            },
            sorter: (a, b) => {
                const tankA = tanks.find(t => t.id === a.tankId);
                const tankB = tanks.find(t => t.id === b.tankId);
                const diffA = tankA ? a.dipLiters - Number(tankA.remainingStock) : 0;
                const diffB = tankB ? b.dipLiters - Number(tankB.remainingStock) : 0;
                return diffA - diffB;
            },
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
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space size="small">
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
        </Card>
    );
};

export default DipChartManagement;
