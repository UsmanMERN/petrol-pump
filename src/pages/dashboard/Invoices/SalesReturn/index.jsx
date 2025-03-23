import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, DatePicker, message, Select, Spin, Row, Card } from 'antd';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import moment from 'moment';
import * as XLSX from 'xlsx';

const { Option } = Select;

const SaleReturnInvoiceManagement = () => {
    const [invoices, setInvoices] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [tableLoading, setTableLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchInvoices(),
                fetchCustomers(),
                fetchProducts()
            ]);
        } finally {
            setLoading(false);
        }
    };

    const fetchInvoices = async () => {
        setTableLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'saleReturnInvoices'));
            setInvoices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            message.error('Failed to fetch invoices: ' + error.message);
        } finally {
            setTableLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'accounts'));
            setCustomers(
                querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(account => account.accountType === "customer")
            );
        } catch (error) {
            message.error('Failed to fetch customers: ' + error.message);
        }
    };

    const fetchProducts = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'products'));
            setProducts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            message.error('Failed to fetch products: ' + error.message);
        }
    };

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue({
                customerId: record.customerId,
                productId: record.productId,
                date: record.date ? moment(record.date) : moment(),
                quantity: record.quantity,
                unitPrice: record.unitPrice,
            });
        } else {
            setEditingId(null);
            form.resetFields();
            form.setFieldsValue({ date: moment() });
        }
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handleSubmit = async (values) => {
        setSubmitting(true);
        try {
            const { quantity, unitPrice, ...rest } = values;
            const amount = quantity * unitPrice;
            const data = {
                ...rest,
                quantity,
                unitPrice,
                amount,
                date: values.date.toISOString()
            };
            if (editingId) {
                await updateDoc(doc(db, 'saleReturnInvoices', editingId), data);
                message.success('Sale return invoice updated');
            } else {
                await addDoc(collection(db, 'saleReturnInvoices'), data);
                message.success('Sale return invoice created');
            }
            setIsModalVisible(false);
            fetchInvoices();
        } catch (error) {
            message.error('Operation failed: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        setDeleting(id);
        try {
            await deleteDoc(doc(db, 'saleReturnInvoices', id));
            message.success('Sale return invoice deleted');
            fetchInvoices();
        } catch (error) {
            message.error('Delete failed: ' + error.message);
        } finally {
            setDeleting(null);
        }
    };

    const exportToExcel = async () => {
        setExporting(true);
        try {
            const exportData = invoices.map(invoice => {
                const customer = customers.find(c => c.id === invoice.customerId);
                const product = products.find(p => p.id === invoice.productId);
                return {
                    'Customer': customer ? customer.accountName : 'Unknown',
                    'Product': product ? product.productName : 'Unknown',
                    'Date': new Date(invoice.date).toLocaleDateString(),
                    'Quantity': invoice.quantity,
                    'Unit Price': invoice.unitPrice,
                    'Amount': invoice.amount
                };
            });
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sale Return Invoices');
            XLSX.writeFile(workbook, 'sale_return_invoices.xlsx');
        } catch (error) {
            message.error('Export failed: ' + error.message);
        } finally {
            setExporting(false);
        }
    };

    const columns = [
        {
            title: 'Customer',
            dataIndex: 'customerId',
            key: 'customerId',
            render: customerId => {
                const customer = customers.find(c => c.id === customerId);
                return customer ? customer.accountName : 'Unknown';
            },
        },
        {
            title: 'Product',
            dataIndex: 'productId',
            key: 'productId',
            render: productId => {
                const product = products.find(p => p.id === productId);
                return product ? product.productName : 'Unknown';
            },
        },
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            render: text => new Date(text).toLocaleDateString()
        },
        {
            title: 'Quantity',
            dataIndex: 'quantity',
            key: 'quantity'
        },
        {
            title: 'Unit Price',
            dataIndex: 'unitPrice',
            key: 'unitPrice',
            render: price => price
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            render: amount => amount
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <>
                    <Button
                        onClick={() => showModal(record)}
                        disabled={deleting === record.id || tableLoading}
                    >
                        Edit
                    </Button>
                    <Button
                        danger
                        onClick={() => handleDelete(record.id)}
                        style={{ marginLeft: 8 }}
                        loading={deleting === record.id}
                        disabled={tableLoading}
                    >
                        Delete
                    </Button>
                </>
            ),
        },
    ];

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '50px' }}>
                <Spin size="large" tip="Loading data..." />
            </div>
        );
    }

    return (
        <Card>
            <Row justify="space-between" style={{ marginBottom: '20px' }}>
                <h2>Sale Return Invoices</h2>
                <div style={{ marginBottom: 16, display: 'flex', gap: '16px' }}>
                    <Button
                        type="primary"
                        onClick={() => showModal()}
                        disabled={tableLoading}
                    >
                        Add Sale Return Invoice
                    </Button>
                    <Button
                        onClick={exportToExcel}
                        loading={exporting}
                        disabled={tableLoading || invoices.length === 0}
                    >
                        Export to Excel
                    </Button>
                </div>
            </Row>
            <Table
                dataSource={invoices}
                columns={columns}
                rowKey="id"
                loading={tableLoading}
            />
            <Modal
                title={editingId ? 'Edit Sale Return Invoice' : 'Add Sale Return Invoice'}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
                maskClosable={!submitting}
                closable={!submitting}
            >
                <Form form={form} onFinish={handleSubmit} layout="vertical">
                    <Form.Item
                        name="customerId"
                        label="Customer"
                        rules={[{ required: true, message: 'Please select a customer' }]}
                    >
                        <Select
                            placeholder="Select a customer"
                            disabled={submitting}
                        >
                            {customers.map(customer => (
                                <Option key={customer.id} value={customer.id}>
                                    {customer.accountName}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="productId"
                        label="Product"
                        rules={[{ required: true, message: 'Please select a product' }]}
                    >
                        <Select
                            placeholder="Select a product"
                            disabled={submitting}
                        >
                            {products.map(product => (
                                <Option key={product.id} value={product.id}>
                                    {product.productName}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="date"
                        label="Date"
                        rules={[{ required: true, message: 'Please select a date' }]}
                    >
                        <DatePicker
                            style={{ width: '100%' }}
                            disabled={submitting}
                        />
                    </Form.Item>
                    <Form.Item
                        name="quantity"
                        label="Quantity"
                        rules={[{ required: true, message: 'Please enter quantity' }]}
                    >
                        <Input
                            type="number"
                            disabled={submitting}
                        />
                    </Form.Item>
                    <Form.Item
                        name="unitPrice"
                        label="Unit Price"
                        rules={[{ required: true, message: 'Please enter unit price' }]}
                    >
                        <Input
                            type="number"
                            disabled={submitting}
                        />
                    </Form.Item>
                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={submitting} disabled={submitting}
                        >
                            {editingId ? 'Update' : 'Create'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default SaleReturnInvoiceManagement;