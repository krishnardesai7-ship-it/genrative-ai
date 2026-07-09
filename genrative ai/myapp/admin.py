from django.contrib import admin
from .models import ChatUser

@admin.register(ChatUser)
class ChatUserAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'created_at', 'last_login')
    search_fields = ('email', 'name')
