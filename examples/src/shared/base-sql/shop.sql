-- Shop: customers, products and orders.
create table customers (
  id serial primary key,
  name text not null,
  email text,
  country text,
  tier text
);
create table products (
  id serial primary key,
  name text not null,
  category text,
  price numeric,
  in_stock int
);
create table orders (
  id serial primary key,
  order_no text not null,
  status text,
  ordered_on date,
  total numeric,
  customer_id int references customers(id)
);

insert into customers (name, email, country, tier) values
  ('Maria Anders', 'maria@example.com', 'Germany', 'Gold'), ('Ken Sato', 'ken@example.com', 'Japan', 'Silver'),
  ('Rita Gomez', 'rita@example.com', 'Spain', 'Gold'), ('Lee Wong', 'lee@example.com', 'Singapore', 'Silver'),
  ('Omar Haddad', 'omar@example.com', 'Jordan', 'Bronze'), ('Eva Novak', 'eva@example.com', 'Czechia', 'Bronze');
insert into products (name, category, price, in_stock) values
  ('Trail shoes', 'Footwear', 129, 40), ('Rain jacket', 'Outerwear', 189, 12), ('Wool socks', 'Accessories', 19, 200),
  ('Running cap', 'Accessories', 25, 85), ('Down vest', 'Outerwear', 149, 0), ('Road shoes', 'Footwear', 139, 33);
insert into orders (order_no, status, ordered_on, total, customer_id) values
  ('A-1001', 'Paid', current_date - 9, 148, 1), ('A-1002', 'Shipped', current_date - 7, 189, 2),
  ('A-1003', 'Delivered', current_date - 20, 38, 3), ('A-1004', 'Paid', current_date - 2, 278, 4),
  ('A-1005', 'Refunded', current_date - 15, 149, 5), ('A-1006', 'Shipped', current_date - 4, 164, 1),
  ('A-1007', 'Delivered', current_date - 30, 25, 6), ('A-1008', 'Paid', current_date - 1, 139, 3);
