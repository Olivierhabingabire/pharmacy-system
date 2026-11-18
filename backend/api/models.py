from django.db import models


class Medicine(models.Model):
    name = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField()
    expiry_date = models.DateField()

    class Meta:
        managed = False        # the table already exists in Supabase
        db_table = "medicines"
        ordering = ["id"]

    def __str__(self):
        return self.name