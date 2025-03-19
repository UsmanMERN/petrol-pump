import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Select, Space, Card,
    Typography, message, Tooltip, Popconfirm, InputNumber,
    Upload, Row, Col, Divider, Progress
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, UploadOutlined, DatabaseOutlined,
    LineChartOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { exportToExcel } from '../../../../services/exportService';
import { db } from '../../../../config/firebase';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale);

const { Title } = Typography;
const { Option } = Select;

const DipChartManagement = () => {
    const [dipCharts, setDipCharts] = useState([]);
    const [tanks, setTanks] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isBulkModalVisible, setIsBulkModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [bulkForm] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedTank, setSelectedTank] = useState(null);
    const [chartData, setChartData] = useState(null);

    useEffect(() => {
        fetchDipCharts();
        fetchTanks();
    }, []);

    const fetchDipCharts = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "dipcharts"));
            const dipChartList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
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
            const tankList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTanks(tankList);
        } catch (error) {
            message.error("Failed to fetch tanks: " + error.message);
        }
    };

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue(record);
        } else {
            setEditingId(null);
            form.resetFields();
        }
        setIsModalVisible(true);
    };

    const showBulkModal = () => {
        bulkForm.resetFields();
        setIsBulkModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handleBulkCancel = () => {
        setIsBulkModalVisible(false);
        bulkForm.resetFields();
    };

    const handleSubmit = async (values) => {
        try {
            if (editingId) {
                await updateDoc(doc(db, "dipcharts", editingId), values);
                message.success("Dip chart updated successfully");
            } else {
                await addDoc(collection(db, "dipcharts"), values);
                message.success("Dip chart created successfully");
            }
            setIsModalVisible(false);
            fetchDipCharts();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        }
    };

    const handleBulkSubmit = async (values) => {
        try {
            const { tankId, dipChartData } = values;

            // Create array of entries from text input
            const entries = dipChartData.split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => {
                    const [inches, liters] = line.split(',').map(item => item.trim());
                    return {
                        tankId,
                        chartCode: `${tankId}-${inches}`,
                        dipInches: parseFloat(inches),
                        dipLiters: parseFloat(liters)
                    };
                });

            // Batch add entries
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
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, "dipcharts", id));
            message.success("Dip chart deleted successfully");
            fetchDipCharts();
        } catch (error) {
            message.error("Delete failed: " + error.message);
        }
    };

    const handleExportToExcel = () => {
        exportToExcel(dipCharts, 'DipCharts');
        message.success("Exported successfully");
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
            <div className="dipchart-header">
                <Title level={3}>Dip Chart Management</Title>
                <Space>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => showModal()}
                    >
                        Add Entry
                    </Button>
                    <Button
                        type="default"
                        icon={<UploadOutlined />}
                        onClick={showBulkModal}
                    >
                        Bulk Import
                    </Button>
                    <Button
                        type="default"
                        icon={<FileExcelOutlined />}
                        onClick={handleExportToExcel}
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
                    >
                        {tanks.map(tank => (
                            <Option key={tank.id} value={tank.id}>{tank.tankName}</Option>
                        ))}
                    </Select>
                </Col>
            </Row>

            <Table
                columns={columns}
                dataSource={selectedTank ? dipCharts.filter(d => d.tankId === selectedTank) : dipCharts}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
                bordered
                scroll={{ x: 'max-content' }}
            />

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

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleCancel}>Cancel</Button>
                            <Button type="primary" htmlType="submit">
                                {editingId ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>

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
                            <Button onClick={handleBulkCancel}>Cancel</Button>
                            <Button type="primary" htmlType="submit">
                                Import Data
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