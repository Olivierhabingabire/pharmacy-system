from django.db import models
from django.utils import timezone


class Medicine(models.Model):
    name = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField()
    expiry_date = models.DateField()

    class Meta:
        managed = False
        db_table = "medicines"
        ordering = ["id"]

    def __str__(self):
        return self.name


class Sale(models.Model):
    receipt_id = models.UUIDField()
    medicine = models.ForeignKey(
        Medicine, on_delete=models.DO_NOTHING, db_column="medicine_id"
    )
    qty = models.IntegerField()
    seller_id = models.UUIDField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    sold_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "sales"
        ordering = ["id"]


class Profile(models.Model):
    id = models.UUIDField(primary_key=True)
    role = models.TextField()
    email = models.EmailField(default="", blank=True)
    full_name = models.TextField(default="", blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "profiles"


class RegistrationSetting(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True)
    code_hash = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "registration_settings"