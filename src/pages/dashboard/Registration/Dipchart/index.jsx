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
import { mmArray, ltrArray } from '../../../../data/dipdata';

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

function getLiters(mm) {
    if (mm < mmArray[0]) {
        return 0;
    }
    if (mm > mmArray[mmArray.length - 1]) {
        return ltrArray[ltrArray.length - 1];
    }
    for (let i = 0; i < mmArray.length - 1; i++) {
        if (mm >= mmArray[i] && mm <= mmArray[i + 1]) {
            const slope = (ltrArray[i + 1] - ltrArray[i]) / (mmArray[i + 1] - mmArray[i]);
            const liters = ltrArray[i] + slope * (mm - mmArray[i]);
            return Number(liters.toFixed(1));
        }
    }
    return null;
}

const DipChartManagement = () => {
    const { user: currentUser, isAdmin } = useAuth();
    const [form] = Form.useForm();

    const [dipCharts, setDipCharts] = useState([]);
    const [tanks, setTanks] = useState([]);
    const [products, setProducts] = useState([]);

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedTankForCalc, setSelectedTankForCalc] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [buttonLoading, setButtonLoading] = useState(false);

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
                dipMm: record.dipMm || record.dipInches,
                dipLiters: getLiters(record.dipMm || record.dipInches),
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
            title: 'Dip (mm)',
            dataIndex: 'dipMm',
            key: 'dipMm',
            sorter: (a, b) => (a.dipMm || 0) - (b.dipMm || 0),
        },
        {
            title: 'Volume (liters)',
            dataIndex: 'dipLiters',
            key: 'dipLiters',
            sorter: (a, b) => a.dipLiters - b.dipLiters,
        },
        {
            title: 'Book Stock (L)',
            key: 'bookStock',
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
            title: 'Discrepancy (L)',
            key: 'discrepancy',
            render: (_, record) => {
                const tank = tanks.find(t => t.id === record.tankId);
                if (!tank) return '-';
                const discrepancy = Number(tank.remainingStock) - record.dipLiters;
                const color = discrepancy > 0 ? 'red' : discrepancy < 0 ? 'green' : 'inherit';
                return <span style={{ color }}>{discrepancy.toFixed(2)}</span>;
            },
            sorter: (a, b) => {
                const tankA = tanks.find(t => t.id === a.tankId);
                const tankB = tanks.find(t => t.id === b.tankId);
                const discrepancyA = tankA ? Number(tankA.remainingStock) - a.dipLiters : 0;
                const discrepancyB = tankB ? Number(tankB.remainingStock) - b.dipLiters : 0;
                return discrepancyA - discrepancyB;
            },
        },
        {
            title: 'Gain/Loss (L)',
            key: 'gainLoss',
            render: (_, record) => {
                const tank = tanks.find(t => t.id === record.tankId);
                if (!tank) return '-';
                // Calculate the net difference: positive for gain, negative for loss
                const gainLoss = record.dipLiters - Number(tank.remainingStock);
                // Color green for gains, red for losses
                const color = gainLoss >= 0 ? 'green' : 'red';
                return <span style={{ color }}>{gainLoss.toFixed(2)}</span>;
            },
            sorter: (a, b) => {
                const tankA = tanks.find(t => t.id === a.tankId);
                const tankB = tanks.find(t => t.id === b.tankId);
                const gainLossA = a.dipLiters - (tankA ? Number(tankA.remainingStock) : 0);
                const gainLossB = b.dipLiters - (tankB ? Number(tankB.remainingStock) : 0);
                return gainLossA - gainLossB;
            },
        },

        {
            title: 'Recorded Date/Time',
            dataIndex: 'recordedAt',
            key: 'recordedAt',
            render: (date) => date ? new Date(date).toLocaleString() : '-',
            sorter: (a, b) => new Date(a.recordedAt) - new Date(b.recordedAt),
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
                    onValuesChange={(changedValues, allValues) => {
                        if (changedValues.dipMm !== undefined) {
                            const liters = getLiters(changedValues.dipMm);
                            form.setFieldsValue({ dipLiters: liters });
                        }
                    }}
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
                        name="dipMm"
                        label="Dip (mm)"
                        rules={[{ required: true, message: 'Please enter dip in mm' }]}
                    >
                        <InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="Enter dip in mm" />
                    </Form.Item>
                    <Form.Item
                        name="dipLiters"
                        label="Volume (liters)"
                        rules={[{ required: true, message: 'Volume is required' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="Computed volume in liters" disabled />
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