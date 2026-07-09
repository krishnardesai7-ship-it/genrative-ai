from django.urls import path  # type: ignore[import]
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("chat/", views.chat_api, name="chat_api"),
    path("login/", views.login_user, name="login_user"),
]
