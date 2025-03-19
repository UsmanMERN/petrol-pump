import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, DatePicker, message } from 'antd';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';

const SaleInvoiceManagement = () => {
    const [invoices, setInvoices] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        const querySnapshot = await getDocs(collection(db, 'saleInvoices'));
        setInvoices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue({ ...record, date: record.date ? new Date(record.date) : null });
        } else {
            setEditingId(null);
            form.resetFields();
        }
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handleSubmit = async (values) => {
        try {
            const data = { ...values, date: values.date.toISOString() };
            if (editingId) {
                await updateDoc(doc(db, 'saleInvoices', editingId), data);
                message.success('Sale invoice updated');
            } else {
                await addDoc(collection(db, 'saleInvoices'), data);
                message.success('Sale invoice created');
            }
            setIsModalVisible(false);
            fetchInvoices();
        } catch (error) {
            message.error('Operation failed: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, 'saleInvoices', id));
            message.success('Sale invoice deleted');
            fetchInvoices();
        } catch (error) {
            message.error('Delete failed: ' + error.message);
        }
    };

    const columns = [
        { title: 'Invoice ID', dataIndex: 'invoiceId', key: 'invoiceId' },
        { title: 'Customer ID', dataIndex: 'customerId', key: 'customerId' },
        { title: 'Date', dataIndex: 'date', key: 'date', render: text => new Date(text).toLocaleDateString() },
        { title: 'Amount', dataIndex: 'amount', key: 'amount' },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <>
                    <Button onClick={() => showModal(record)}>Edit</Button>
                    <Button danger onClick={() => handleDelete(record.id)} style={{ marginLeft: 8 }}>
                        Delete
                    </Button>
                </>
            ),
        },
    ];

    return (
        <div>
            <Button type="primary" onClick={() => showModal()} style={{ marginBottom: 16 }}>
                Add Sale Invoice
            </Button>
            <Table dataSource={invoices} columns={columns} rowKey="id" />
            <Modal
                title={editingId ? 'Edit Sale Invoice' : 'Add Sale Invoice'}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
            >
                <Form form={form} onFinish={handleSubmit}>
                    <Form.Item name="invoiceId" label="Invoice ID" rules={[{ required: true, message: 'Please enter Invoice ID' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="customerId" label="Customer ID" rules={[{ required: true, message: 'Please enter Customer ID' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Please select a date' }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="amount" label="Amount" rules={[{ required: true, message: 'Please enter amount' }]}>
                        <Input type="number" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            {editingId ? 'Update' : 'Create'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default SaleInvoiceManagement;