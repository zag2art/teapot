

/**
 * Module dependencies.
 */

var env = process.env.NODE_ENV || 'development'
  , mongoose = require('mongoose')
  //, Imager = require('imager')
  , async = require('async')
  //, Product = mongoose.model('Product')
  , _ = require('underscore')
  , nav = require('../../config/navbar')
  , nodemailer = require('nodemailer')
  , Hogan = require('hogan.js')
  , path = require('path')
  , _ = require('underscore')
  , Product = mongoose.model('Product')
  , Order = mongoose.model('Order')
  , config = require('../../config/config')[env]  // , set = require('../../config/middlewares/settings')
  , midCart = require('../../config/middlewares/cart')

;

// Create a SMTP transport object
var transport = nodemailer.createTransport("SMTP", {
        auth: {
            user: config.mail.login,
            pass: config.mail.password
        }
    });

var processTemplate = function (tplPath, locals) {
    var templatePath = path.normalize(__dirname + '/../../app/mailer/templates');
    var tpl = require('fs').readFileSync(templatePath+'/'+tplPath+'.html', 'utf8');
    var template = Hogan.compile(tpl);

    return template.render(locals);
}


// Шлем почту покупателю
var sendmail_to_buyer = function(data, subject, template){

  var message = {
      from: config.mail.name + ' <' + config.mail.login+ '>',
      to: data.buyer.name + ' <' + data.buyer.email+'>',
      subject: subject,

      html: processTemplate(template, data)

  };

  transport.sendMail(message, function(error){

    if(error){
      console.log('Error sending message to buyer!');
      return;
    }

  });
};

// Шлем почту покупателю
var sendmail_to_seller = function(data, subject, template){

  var message = {
      from: config.mail.name + ' <' + config.mail.login+ '>',
      to:   config.mail.name + ' <' + config.mail.login+ '>',
      subject: subject,

      html: processTemplate(template, data)

  };

  transport.sendMail(message, function(error){

    if(error){
      console.log('Error sending message to buyer!');
      return;
    }

  });
};

// Формируем заказ
var make_order = function(req, res, cb){
  var order = new Order()
    , total = res.locals.setting.deliveryPrice
    , body = req.body
    , cart = req.session.cart_items
    // , ids = []
  ;
  // _.each(cart, function(doc){
  //   ids.push(mongoose.Types.ObjectId(doc.id));
  // });

  // Product.find({_id:{$in: ids}}).exec(function(err, docs){
  Product.findByObjIds(cart, function(err, docs){
    if (err) {
      return cb(new Error('Не найдены товары из корзины!'));
    }
    var prod, obj;

    // console.log('products: ', docs);
    // console.log('cart: ', cart);

    _.each(cart, function(doc){
      _.each(docs, function(p){
        if (p._id.toString() === doc.id) {
          prod = p;
        }
      });

      obj = {
        id: doc.id,
        name: prod.name,
        count: Math.round(doc.count),
        cost: doc.cost,
        price: prod.price,
        unit: prod.unit,
        max_count: prod.count
      };

      if (obj.count > prod.count){
        obj.count = prod.count;
      }

      if (obj.count < 0){
        obj.count = 0;
      }

      obj.cost = obj.count * obj.price;

      if (obj.count > 0) {
        order.items.push(obj);
      }
      total += obj.cost;
    });

    order.cost = total;

    order.comment_buyer = body.message;

    order.buyer = {
      name: body.name,
      address: body.zip + ', ' + body.address,
      email: body.email,
      session_id: req.sessionID,
      ip: req.headers['x-client-ip']
    };

    order.payment_method = body.payment;

    order.statuses.push({ //Создан, Оплачен, Отправлен, Закрыт, Отменен
      status: 'Создан'
    });

    order.save(cb);

  });


};

// Меняем складские остатки
var change_stock = function(cart){
  //console.log('function: change_stock')

  var change_stock_by_id = function(id, count){

    Product.findById(id, function (err, doc){
      console.log(doc, count);

      if (err) return err;

      doc.count = doc.count - count;
      doc.save();

    });
  };

  _.each(cart, function(obj){
      change_stock_by_id(obj.id, obj.count);
  });
};

// Чистим корзину
var clear_cart = function(req, res){
  //console.log('function: clear_cart');
  req.session.cart_items = [];
  res.locals.def_cart = req.session.cart_items;
  res.locals.def_cart_JSON = '[]';

  res.locals.cart = {
    fullcartclass: "hidden",
    emptycartclass: "",
    total: 0
  }

};


//Проверим, что в корзине все ОК, на складе всего хватает, если нет - усекаем
var checkCart = function (req, res, cart, docs){
  var addInfo = function(text) {
    if (!res.locals.info) {
      res.locals.info = [];
    }

    res.locals.info.push(text);
  }

  var prod, obj, del = [];


  _.each(cart, function(doc){

    prod = undefined;

    _.each(docs, function(p){
      if (p._id.toString() === doc.id) {
        prod = p;
      }
    }); //products

    if (prod !== undefined) {

      var old_count = doc.count;

      doc.price = Number(prod.price);
      doc.count = Math.round(doc.count);

      if (doc.count > Number(prod.count)){
        doc.count = Number(prod.count);
      }

      if (doc.count < 0){
        doc.count = 0;
      }

      doc.cost = doc.count * doc.price;

      //Картинка
      doc.img = prod.main_image_mini;
      //console.log(doc.img);

    }

    if (doc.count === 0 || prod === undefined) {
      addInfo('Товар "'+doc.name+'" закончился!');
      del.push(cart.indexOf(doc));
      //TODO удалить товар из корзины
    } else if (doc.count !== old_count) {
      //console.log('doc.count: ', doc.count, typeof doc.count);
      //console.log('old_count: ', old_count, typeof old_count);

      addInfo('Количество товара "'+doc.name+'" приведено в соответствие с остатками!');
    }

  }); //cart

  del.sort(function(a,b){return b-a}); //desc

  _.each(del, function(index){
    cart.splice(index, 1);
  });

  req.session.cart_items = [];

  _.each(cart, function(obj){
    req.session.cart_items.push({
      id: obj.id,
      count: obj.count,
      cost: obj.cost,
      name: obj.name,
      price: obj.price,
      unit: obj.unit,
      max_count: obj.max_count
    });
  });

  if (req.session.cart_items) {
    res.locals.def_cart_JSON = JSON.stringify(req.session.cart_items);
  } else {
    res.locals.def_cart_JSON = "[]";
    req.session.cart_items = [];
  }
  res.locals.def_cart = cart;
  //console.log(cart);

  var total = res.locals.setting.deliveryPrice;

  _.each(req.session.cart_items, function(item){
    total += item.cost;
  });

  if (req.session.cart_items.length === 0) {
    res.locals.cart = {
      fullcartclass: "hidden",
      emptycartclass: "",
      total: total
    }
  } else {
    res.locals.cart = {
      fullcartclass : "",
      emptycartclass : "hidden",
      total: total
    }
  }
}

exports.makeOrder = function(req, res, next){
  //TODO
  //Проверить складские запасы перед формированием заказа
  var
  // ids = [],
  cart = _.extend([], req.session.cart_items);

  //, cart = req.session.cart_items;
  ;

  //console.log(cart);

  // _.each(cart, function(doc){ids.push(mongoose.Types.ObjectId(doc.id));});

  Product.findByObjIds(cart, function(err, docs){
    if (err) {
      return next(new Error('Не найдены товары из корзины!'));
    }

    checkCart(req, res, cart, docs); // Корректируем состав корзины

    //midCart.getCart(req, res);

    res.locals.navbar = nav.getNavibar();

    res.locals.bc_list = [{
      name: "Главная страница",
      href: "/"
    }];

    res.locals.bc_active = "Оформление заказа";
    res.locals.getting_order = true;

    res.locals.scripts = [
      'lib/jqBootstrapValidation.js',
      'order.js',
    ];

    var del_arr = req.flash('delivery');
    if (del_arr !== undefined && del_arr.length !== 0) {
      res.locals.delivery = del_arr[del_arr.length - 1];
    }

    res.locals.title = "Teapots - Оформление заказа";
    res.locals.description = "Страница оформления заказа в интернет-магазине чайников и чайных штук TeaPots. Редактирование корзины, ввод данных, выбор ситсемы оплаты";

    //console.log(req.sessionID);

    //req.flash('info', 'Flash is back!')

    res.render('order/order');


  });


};

exports.postOrder = function(req, res, next){
  var redirect;

  req.body.email = req.body['e-mail'];
  //delete req.body['e-mail'];

  //console.log(req.body);

  var back_to_order = function(message){
    req.flash('errors', message);
    redirect = true;
  }

  if (req.session.cart_items === undefined || req.session.cart_items.length === 0) {
    back_to_order('Корзина пуста. Сначало необходимо положить товары в корзину!');
  }

  if (req.body.baracuda === undefined || req.body.baracuda.length !== 0) {
    back_to_order('Ошибка передачи данных!');
  }

  if (req.body.name === undefined || req.body.name.length < 4 || req.body.name.length > 100) {
    back_to_order('Длина поля "ФИО" должна быть от 4-х до 100 символов!');
  }

  if (req.body.address === undefined || req.body.address.length < 4 || req.body.address.length > 200) {
    back_to_order('Длина адреса должна быть от 4-х до 200 символов!');
  }

  if (req.body.zip === undefined || req.body.zip.length !== 6) {
    back_to_order('Длина поля "Индекс" должна быть 6-ть символов!');
  }

  if (req.body.email === undefined || req.body.email.indexOf('&') !== -1) {
    back_to_order('Неверный электронный адрес!');
  }

  if (redirect === true) {
    req.flash('delivery', req.body);

    if (req.xhr === false) {
      res.redirect('/order');
    } else {

      res.send({
        action: 'redirect',
        content: '/order'
      });
    }
    return;
  }

  if (req.body.payment === 'gate') {
    make_order(req, res, function(err, order){

      console.log('order 1: ', order);

      if (err) {

        //TODO проверить после валидации (кинуть ошибки в флеш)
        if (req.xhr === false) {
          return next(err);
        } else {
          req.flash('delivery', req.body);
          return res.send({
            action: 'redirect',
            content: '/order'
          });
        }

      }

      sendmail_to_buyer(_.extend({}, order, app.config), 'Ваш заказ успешно сформирован!', 'gate_order_complite_buyer');
      sendmail_to_seller(_.extend({}, order, app.config), 'Новый заказ в интернет-магазине "TeaPots"', 'gate_order_complite_seller');

      change_stock(req.session.cart_items);
      clear_cart(req, res);

      //console.log('order 2: ', order);

      res.locals.paysto = {
        PAYSTO_SHOP_ID: config.paysto.shopId,
        PAYSTO_SUM: order.cost,
        PAYSTO_INVOICE_ID: order._id,
        PAYSTO_DESC: 'Оплата товаров по заказу №' + order._id,
        PayerEMail: order.buyer.email
      }

      if (req.xhr === false) {
        res.locals.navbar = nav.getNavibar();

        res.locals.bc_list = [{
          name: "Главная страница",
          href: "/"
        }];

        res.locals.bc_active = "Перенаправление в систему оплаты";
        res.locals.getting_order = true;

        res.locals.scripts = ['paysto.redirect.js'];

        res.render('paysto/redirect');
      } else {
        return res.send({
          action: 'paysto',
          content: JSON.stringify(res.locals.paysto)
        });
      }
    });

  } else {
    make_order(req, res, function(err, order){
      if (err) {

        //TODO проверить после валидации (кинуть ошибки в флеш)
        if (req.xhr === false) {
          return next(err);
        } else {
          req.flash('delivery', req.body);
          return res.send({
            action: 'redirect',
            content: '/order'
          });
        }

      }

      sendmail_to_buyer(_.extend({}, order, app.config), 'Ваш заказ успешно сформирован!', 'sb_order_complite_buyer');
      sendmail_to_seller(_.extend({}, order, app.config), 'Новый заказ в интернет-магазине "TeaPots"', 'sb_order_complite_seller');

      change_stock(req.session.cart_items);
      clear_cart(req, res);

      if (req.xhr === false) {
        res.locals.navbar = nav.getNavibar();

        res.locals.bc_list = [{
          name: "Главная страница",
          href: "/"
        }];

        res.locals.sberbank = app.config.sberbank;

        res.locals.bc_active = "Заказ успешно создан";
        res.locals.getting_order = true;

        res.render('order/complete');
      }
      else {
        res.locals.sberbank = app.config.sberbank;

        res.render('order/complete', {layout: ""}, function(err, html){

          res.send({
            action: "redraw",
            content: html
          });
          //console.log(html);
        });
      }



    });
  }

  //Если нужно оплачивать - оплатить
  //Послать на почту покупателю и Насте уведомления
  //Сформировать заказ в таблице "заказы"
  //Уменьшить складские запасы

};

exports.completeOrder =  function(req, res){

  res.locals.navbar = nav.getNavibar();

    res.locals.bc_list = [{
        name: "Главная страница",
        href: "/"
      }];

  res.locals.bc_active = "Заказ успешно создан";
  res.locals.getting_order = false;

  res.render('order/complete');

};

