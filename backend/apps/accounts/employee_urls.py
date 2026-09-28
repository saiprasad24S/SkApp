from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import CurrentEmployeeView, EmployeeViewSet, UploadProfilePhotoView

router = DefaultRouter()
router.register(r"", EmployeeViewSet, basename="employees")

urlpatterns = [
    path("current/me/", CurrentEmployeeView.as_view(), name="employee-current-me"),
    path("current/me", CurrentEmployeeView.as_view(), name="employee-current-me-noslash"),
    path("current/<int:employee_id>/", CurrentEmployeeView.as_view(), name="employee-current"),
    path("<int:pk>/upload-photo/", UploadProfilePhotoView.as_view(), name="employee-upload-photo"),
    path("", include(router.urls)),
]
