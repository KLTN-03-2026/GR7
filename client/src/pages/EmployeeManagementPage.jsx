import React, { useState, useEffect } from 'react';
import {
    FaUserPlus,
    FaEdit,
    FaSearch,
    FaRegStopCircle,
    FaCheckCircle,
    FaTrashAlt,
    FaTrashRestore,
    FaExclamationTriangle,
} from 'react-icons/fa';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Axios from '@/utils/Axios';
import SummaryApi from '@/common/SummaryApi';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import Loading from '@/components/Loading';

const EmployeeManagementPage = () => {
    const user = useSelector((state) => state?.user);

    // Tabs state
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'deleted'

    // Data states
    const [users, setUsers] = useState([]);
    const [deletedUsers, setDeletedUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    // Modals state
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState({
        show: false,
        action: '',
        user: null,
    });

    // Form data
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        email: '',
        password: '',
        role: 'CUSTOMER',
        status: 'Active',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const rolesList = [
        'ADMIN',
        'MANAGER',
        'CHEF',
        'WAITER',
        'CASHIER',
        'CUSTOMER',
    ];

    const fetchActiveUsers = async () => {
        try {
            setLoading(true);
            const response = await Axios({
                ...SummaryApi.get_admin_users,
            });

            if (response.data.success) {
                setUsers(response.data.data);
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    'Lỗi khi tải danh sách người dùng'
            );
        } finally {
            setLoading(false);
        }
    };

    const fetchDeletedUsers = async () => {
        try {
            setLoading(true);
            const response = await Axios({
                ...SummaryApi.get_deleted_admin_users,
            });

            if (response.data.success) {
                setDeletedUsers(response.data.data);
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    'Lỗi khi tải danh sách người dùng đã xóa'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'active') {
            fetchActiveUsers();
        } else {
            fetchDeletedUsers();
        }
        setCurrentPage(1);
    }, [activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleOpenAdd = () => {
        setFormData({
            id: '',
            name: '',
            email: '',
            password: '',
            role: 'WAITER',
            status: 'Active',
        });
        setShowAddModal(true);
    };

    const handleOpenEdit = (userToEdit) => {
        setFormData({
            id: userToEdit._id,
            name: userToEdit.name,
            email: userToEdit.email,
            password: '',
            role: userToEdit.role,
            status: userToEdit.status,
        });
        setShowEditModal(true);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const response = await Axios({
                ...SummaryApi.create_admin_user,
                data: {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
                },
            });

            if (response.data.success) {
                toast.success(response.data.message);
                setShowAddModal(false);
                fetchActiveUsers();
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message || 'Có lỗi xảy ra khi tạo'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const response = await Axios({
                ...SummaryApi.update_admin_user,
                url: SummaryApi.update_admin_user.url + '/' + formData.id,
                data: {
                    name: formData.name,
                    role: formData.role,
                    status: formData.status,
                },
            });

            if (response.data.success) {
                toast.success(response.data.message);
                setShowEditModal(false);
                fetchActiveUsers();
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message || 'Trục trặc khi cập nhật'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleActionConfirm = async () => {
        const { action, user: targetUser } = showConfirmModal;
        try {
            setIsSubmitting(true);
            let response;

            if (action === 'soft_delete') {
                response = await Axios({
                    ...SummaryApi.soft_delete_admin_user,
                    url:
                        SummaryApi.soft_delete_admin_user.url +
                        '/' +
                        targetUser._id,
                });
            } else if (action === 'restore') {
                response = await Axios({
                    ...SummaryApi.restore_admin_user,
                    url:
                        SummaryApi.restore_admin_user.url +
                        '/' +
                        targetUser._id,
                });
            } else if (action === 'hard_delete') {
                response = await Axios({
                    ...SummaryApi.hard_delete_admin_user,
                    url:
                        SummaryApi.hard_delete_admin_user.url +
                        '/' +
                        targetUser._id,
                });
            }

            if (response.data.success) {
                toast.success(response.data.message);
                setShowConfirmModal({ show: false, action: '', user: null });
                if (activeTab === 'active') fetchActiveUsers();
                if (activeTab === 'deleted') fetchDeletedUsers();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Thao tác thất bại');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openConfirmModal = (action, u) => {
        setShowConfirmModal({ show: true, action, user: u });
    };

    const dataToDisplay = activeTab === 'active' ? users : deletedUsers;
    const filteredUsers = dataToDisplay.filter(
        (u) =>
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Pagination logic
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const paginatedUsers = filteredUsers.slice(
        indexOfFirstItem,
        indexOfLastItem
    );

    return (
        <section className="container mx-auto grid gap-4 animate-in fade-in duration-500">
            {/* Header Card */}
            <Card className="py-6 border-card-foreground">
                <CardHeader className="flex flex-row items-center justify-between gap-6">
                    <div className="space-y-1">
                        <CardTitle className="text-xl text-highlight font-bold uppercase">
                            Tài khoản Hệ thống
                        </CardTitle>
                        <CardDescription>
                            Quản lý nhân sự, phân quyền và trạng thái hoạt động
                            của tài khoản.
                        </CardDescription>
                    </div>
                    {user.role === 'ADMIN' && activeTab === 'active' && (
                        <Button
                            onClick={handleOpenAdd}
                            className="bg-highlight hover:bg-highlight_2 text-white flex items-center gap-2"
                        >
                            <FaUserPlus /> Thêm tài khoản
                        </Button>
                    )}
                </CardHeader>
            </Card>

            {/* Filter Area */}
            <div className="liquid-glass border-2 border-border rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Tìm theo tên hoặc email..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full md:w-auto"
                >
                    <TabsList className="grid grid-cols-2 w-full md:w-[300px]">
                        <TabsTrigger value="active">
                            Hoạt động ({users.length})
                        </TabsTrigger>
                        <TabsTrigger value="deleted">
                            Thùng rác ({deletedUsers.length})
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Main Table Content */}
            <div className="bg-background border-2 border-border rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-muted text-muted-foreground border-b border-border">
                            <tr>
                                <th className="px-6 py-4 font-bold">
                                    Người dùng
                                </th>
                                <th className="px-6 py-4 font-bold">Vai trò</th>
                                <th className="px-6 py-4 font-bold text-center">
                                    Trạng thái
                                </th>
                                <th className="px-6 py-4 font-bold text-center">
                                    {activeTab === 'active'
                                        ? 'Ngày tham gia'
                                        : 'Ngày xóa'}
                                </th>
                                <th className="px-6 py-4 font-bold text-center">
                                    Hành động
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="py-20">
                                        <Loading />
                                    </td>
                                </tr>
                            ) : paginatedUsers.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="5"
                                        className="px-6 py-10 text-center text-muted-foreground"
                                    >
                                        Không tìm thấy tài khoản nào phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((u, index) => (
                                    <tr
                                        key={u._id}
                                        className="hover:bg-muted/50 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground text-base">
                                                    {u.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {u.email}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                    u.role === 'ADMIN'
                                                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                        : u.role === 'MANAGER'
                                                          ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                                                          : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                }`}
                                            >
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {u.status === 'Active' ? (
                                                <span className="inline-flex items-center gap-1 text-green-500 font-medium">
                                                    <FaCheckCircle size={12} />{' '}
                                                    Hoạt động
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                                                    <FaRegStopCircle
                                                        size={12}
                                                    />{' '}
                                                    Đã khóa
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center text-muted-foreground text-xs">
                                            {format(
                                                new Date(
                                                    activeTab === 'active'
                                                        ? u.createdAt
                                                        : u.deletedAt ||
                                                              u.updatedAt
                                                ),
                                                'dd/MM/yyyy HH:mm',
                                                { locale: vi }
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                {activeTab === 'active' ? (
                                                    <>
                                                        <button
                                                            onClick={() =>
                                                                handleOpenEdit(
                                                                    u
                                                                )
                                                            }
                                                            className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                                                            title="Sửa thông tin"
                                                        >
                                                            <FaEdit size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                openConfirmModal(
                                                                    'soft_delete',
                                                                    u
                                                                )
                                                            }
                                                            className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                                                            title="Đưa vào thùng rác"
                                                        >
                                                            <FaTrashAlt
                                                                size={14}
                                                            />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() =>
                                                                openConfirmModal(
                                                                    'restore',
                                                                    u
                                                                )
                                                            }
                                                            className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
                                                            title="Khôi phục"
                                                        >
                                                            <FaTrashRestore
                                                                size={14}
                                                            />
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                openConfirmModal(
                                                                    'hard_delete',
                                                                    u
                                                                )
                                                            }
                                                            className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                                                            title="Xóa vĩnh viễn"
                                                        >
                                                            <FaTrashAlt
                                                                size={14}
                                                            />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {!loading && filteredUsers.length > 0 && (
                    <div className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-between gap-4">
                        <div className="text-xs text-muted-foreground font-medium flex gap-1.5">
                            Hiển thị{' '}
                            <span className="font-bold text-foreground">
                                {indexOfFirstItem + 1}
                            </span>{' '}
                            -{' '}
                            <span className="font-bold text-foreground">
                                {Math.min(
                                    indexOfLastItem,
                                    filteredUsers.length
                                )}
                            </span>{' '}
                            trên tổng số{' '}
                            <span className="font-bold text-foreground">
                                {filteredUsers.length}
                            </span>{' '}
                            tài khoản
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.max(prev - 1, 1)
                                    )
                                }
                                disabled={currentPage === 1}
                                className="h-8 w-8 p-0"
                            >
                                &lt;
                            </Button>

                            <div className="flex items-center gap-1 mx-2">
                                {[...Array(totalPages)].map((_, i) => {
                                    const pageNum = i + 1;
                                    // Hiển thị tối đa 5 nút trang xung quanh trang hiện tại
                                    if (
                                        totalPages <= 7 ||
                                        pageNum === 1 ||
                                        pageNum === totalPages ||
                                        (pageNum >= currentPage - 1 &&
                                            pageNum <= currentPage + 1)
                                    ) {
                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={
                                                    currentPage === pageNum
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                size="sm"
                                                onClick={() =>
                                                    setCurrentPage(pageNum)
                                                }
                                                className={`h-8 w-8 p-0 text-xs ${currentPage === pageNum ? 'bg-highlight hover:bg-highlight_2 text-white' : ''}`}
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    } else if (
                                        (pageNum === currentPage - 2 &&
                                            pageNum > 1) ||
                                        (pageNum === currentPage + 2 &&
                                            pageNum < totalPages)
                                    ) {
                                        return (
                                            <span
                                                key={pageNum}
                                                className="text-muted-foreground px-1"
                                            >
                                                ...
                                            </span>
                                        );
                                    }
                                    return null;
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.min(prev + 1, totalPages)
                                    )
                                }
                                disabled={currentPage === totalPages}
                                className="h-8 w-8 p-0"
                            >
                                &gt;
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals - Standardized glass style */}
            {(showAddModal || showEditModal) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
                    <div className="bg-background border-2 border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold text-highlight uppercase mb-6 flex items-center gap-2">
                            {showAddModal ? <FaUserPlus /> : <FaEdit />}
                            {showAddModal
                                ? 'Tạo tài khoản mới'
                                : 'Cập nhật tài khoản'}
                        </h3>
                        <form
                            onSubmit={
                                showAddModal
                                    ? handleCreateUser
                                    : handleUpdateUser
                            }
                            className="space-y-4"
                        >
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold uppercase text-muted-foreground tracking-wider">
                                    Họ và tên
                                </label>
                                <Input
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Nhập tên nhân viên"
                                />
                            </div>

                            {showAddModal && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold uppercase text-muted-foreground tracking-wider">
                                            Email
                                        </label>
                                        <Input
                                            type="email"
                                            name="email"
                                            required
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="email@eatease.com"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold uppercase text-muted-foreground tracking-wider">
                                            Mật khẩu
                                        </label>
                                        <Input
                                            type="password"
                                            name="password"
                                            required
                                            minLength={6}
                                            value={formData.password}
                                            onChange={handleChange}
                                            placeholder="******"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold uppercase text-muted-foreground tracking-wider">
                                        Vai trò
                                    </label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleChange}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-highlight"
                                    >
                                        {rolesList.map((r) => (
                                            <option key={r} value={r}>
                                                {r}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {!showAddModal && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold uppercase text-muted-foreground tracking-wider">
                                            Trạng thái
                                        </label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleChange}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-highlight"
                                        >
                                            <option value="Active">
                                                Hoạt động
                                            </option>
                                            <option value="Inactive">
                                                Khóa
                                            </option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3 mt-8 pt-6 border-t border-border">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setShowEditModal(false);
                                    }}
                                    className="flex-1"
                                >
                                    Hủy
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 bg-highlight hover:bg-highlight_2 text-white"
                                >
                                    {isSubmitting
                                        ? 'Đang xử lý...'
                                        : showAddModal
                                          ? 'Tạo tài khoản'
                                          : 'Lưu thay đổi'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {showConfirmModal.show && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-background border-2 border-border rounded-xl p-6 w-full max-w-sm shadow-2xl text-center">
                        <div
                            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                                showConfirmModal.action === 'restore'
                                    ? 'bg-green-100 text-green-600'
                                    : 'bg-red-100 text-red-600'
                            }`}
                        >
                            <FaExclamationTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-bold mb-2">
                            {showConfirmModal.action === 'soft_delete'
                                ? 'Đưa vào Thùng rác?'
                                : showConfirmModal.action === 'restore'
                                  ? 'Khôi phục tài khoản?'
                                  : 'Xác nhận xóa vĩnh viễn?'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-8">
                            Bạn đang thực hiện thao tác này trên tài khoản{' '}
                            <span className="font-bold text-foreground">
                                {showConfirmModal.user?.name}
                            </span>
                            .
                            {showConfirmModal.action === 'hard_delete' &&
                                ' Hành động này không thể hoàn tác!'}
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    setShowConfirmModal({
                                        show: false,
                                        action: '',
                                        user: null,
                                    })
                                }
                                className="flex-1"
                            >
                                Quay lại
                            </Button>
                            <Button
                                onClick={handleActionConfirm}
                                disabled={isSubmitting}
                                className={`flex-1 ${showConfirmModal.action === 'restore' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
                            >
                                {isSubmitting ? 'Chờ...' : 'Xác nhận'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default EmployeeManagementPage;
